import { useCallback, useEffect, useRef, useState } from "react";
import { useServerStore } from "../store/serverStore";
import type { LogResponse, LogSourceType, LogWsMessage } from "../types/log";

const TARGET_PLACEHOLDER: Record<LogSourceType, string> = {
  file: "/var/log/syslog 또는 /var/log/nginx/access.log",
  journal: "sshd.service 또는 docker.service (비우면 전체)",
  docker: "container_name 또는 container_id",
};

const SOURCE_LABEL: Record<LogSourceType, string> = {
  file: "File tail",
  journal: "journalctl",
  docker: "docker logs",
};

const WS_URL = import.meta.env.DEV
  ? "ws://localhost:3001/ws"
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

const MAX_FOLLOW_LINES = 2000;

export function LogPanel() {
  const activeServerId = useServerStore((state) => state.activeServerId);
  const [source, setSource] = useState<LogSourceType>("journal");
  const [target, setTarget] = useState("");
  const [lines, setLines] = useState(80);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LogResponse | null>(null);
  const [followActive, setFollowActive] = useState(false);
  const [followReady, setFollowReady] = useState(false);
  const [followLines, setFollowLines] = useState<string[]>([]);
  const [stickToBottom, setStickToBottom] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const loadLogsRef = useRef<((args?: {
    nextServerId?: string;
    nextSource?: LogSourceType;
    nextTarget?: string;
    nextLines?: number;
  }) => Promise<LogResponse | null>) | null>(null);

  const loadLogs = useCallback(async ({
    nextServerId = activeServerId,
    nextSource = source,
    nextTarget = target,
    nextLines = lines,
  }: {
    nextServerId?: string;
    nextSource?: LogSourceType;
    nextTarget?: string;
    nextLines?: number;
  } = {}) => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    if ((nextSource === "file" || nextSource === "docker") && !nextTarget.trim()) {
      setError(nextSource === "file" ? "파일 경로를 입력하세요." : "컨테이너 이름 또는 ID를 입력하세요.");
      setResult(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        server_id: nextServerId,
        source: nextSource,
        lines: String(nextLines),
      });

      if (nextTarget.trim()) {
        params.set("target", nextTarget.trim());
      }

      const response = await fetch(`/api/logs/recent?${params.toString()}`, {
        signal: controller.signal,
      });
      const body = await response.json() as LogResponse | { ok: false; error?: string };

      if (!response.ok || !("ok" in body) || body.ok !== true) {
        throw new Error("error" in body ? body.error || "로그 조회 실패" : "로그 조회 실패");
      }

      if (!controller.signal.aborted) {
        setResult(body);
        return body;
      }
    } catch (fetchError) {
      if (controller.signal.aborted) {
        return null;
      }

      setResult(null);
      setError(fetchError instanceof Error ? fetchError.message : "로그 조회 실패");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }

      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
    return null;
  }, [activeServerId, lines, source, target]);

  const stopFollow = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "log_follow_stop" }));
    }

    setFollowActive(false);
    setFollowReady(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = consoleRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, []);

  const startFollow = useCallback(async () => {
    if ((source === "file" || source === "docker") && !target.trim()) {
      setError(source === "file" ? "파일 경로를 입력하세요." : "컨테이너 이름 또는 ID를 입력하세요.");
      return;
    }

    const initial = await loadLogs();
    if (!initial) {
      return;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("로그 스트림 연결이 준비되지 않았습니다");
      return;
    }

    setFollowLines(initial.lines.map((entry) => entry.text));
    setFollowActive(true);
    setFollowReady(false);
    setStickToBottom(true);
    setError(null);

    ws.send(JSON.stringify({
      type: "log_follow_start",
      query: {
        server_id: activeServerId,
        source,
        target: target.trim() || undefined,
        lines,
      },
    }));
  }, [activeServerId, lines, loadLogs, source, target]);

  useEffect(() => {
    loadLogsRef.current = loadLogs;
  }, [loadLogs]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      let message: LogWsMessage;
      try {
        message = JSON.parse(event.data as string) as LogWsMessage;
      } catch {
        return;
      }

      if (message.type === "log_follow_started") {
        setFollowReady(true);
      } else if (message.type === "log_follow_chunk") {
        setFollowLines((current) => [...current, ...message.lines].slice(-MAX_FOLLOW_LINES));
      } else if (message.type === "log_follow_error") {
        setError(message.message);
        setFollowActive(false);
        setFollowReady(false);
      } else if (message.type === "log_follow_stopped") {
        setFollowActive(false);
        setFollowReady(false);
      }
    };

    ws.onclose = () => {
      setFollowActive(false);
      setFollowReady(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "log_follow_stop" }));
      }
      ws.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    void loadLogsRef.current?.({ nextServerId: activeServerId });
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [activeServerId]);

  useEffect(() => {
    if (followActive) {
      stopFollow();
    }
  }, [activeServerId, source, target, stopFollow]);

  useEffect(() => {
    if (followActive && stickToBottom) {
      scrollToBottom();
    }
  }, [followActive, followLines, stickToBottom, scrollToBottom]);

  const visibleLines = followActive ? followLines : (result?.lines.map((entry) => entry.text) ?? []);

  return (
    <div className="panel panel--log">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Logs</p>
          <h2 className="panel-title">Recent Lines</h2>
        </div>
        <div className="panel-meta-badge">
          {followActive ? (followReady ? "following" : "starting") : result ? `${result.lines.length} lines` : "on demand"}
        </div>
      </div>

      <div className="log-toolbar">
        <div className="panel-view-toggle" role="tablist" aria-label="로그 소스 선택">
          {(["journal", "file", "docker"] as LogSourceType[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`panel-view-toggle__btn ${source === item ? "panel-view-toggle__btn--active" : ""}`}
              onClick={() => setSource(item)}
            >
              {SOURCE_LABEL[item]}
            </button>
          ))}
        </div>

        <div className="log-toolbar__actions">
          <select
            className="log-select"
            value={lines}
            onChange={(event) => setLines(Number(event.target.value))}
          >
            <option value={50}>50줄</option>
            <option value={80}>80줄</option>
            <option value={120}>120줄</option>
            <option value={200}>200줄</option>
          </select>

          <button
            type="button"
            className="log-refresh-btn"
            onClick={() => void loadLogs()}
            disabled={loading || followActive}
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>

          <button
            type="button"
            className={`log-follow-btn ${followActive ? "log-follow-btn--active" : ""}`}
            onClick={() => {
              if (followActive) {
                stopFollow();
              } else {
                void startFollow();
              }
            }}
          >
            {followActive ? "Follow 중지" : "Follow 시작"}
          </button>
        </div>
      </div>

      <label className="log-target-field">
        <span className="log-target-field__label">대상</span>
        <input
          className="log-target-input"
          type="text"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder={TARGET_PLACEHOLDER[source]}
        />
      </label>

      {error ? <p className="log-error">{error}</p> : null}

      {result && !loading ? (
        <div className="log-meta">
          <span>{SOURCE_LABEL[result.source]}</span>
          <span>{result.target ?? "시스템 기본 로그"}</span>
          {followActive ? <span>{followReady ? "실시간 수신 중" : "스트림 연결 중"}</span> : null}
          {followActive && !stickToBottom ? (
            <button
              type="button"
              className="log-jump-btn"
              onClick={() => {
                setStickToBottom(true);
                scrollToBottom();
              }}
            >
              최신으로 이동
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        ref={consoleRef}
        className="log-console"
        aria-live="polite"
        onScroll={() => {
          if (!followActive) {
            return;
          }

          const element = consoleRef.current;
          if (!element) {
            return;
          }

          const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
          setStickToBottom(distanceToBottom < 24);
        }}
      >
        {loading ? (
          <p className="empty-hint">로그를 불러오는 중입니다...</p>
        ) : visibleLines.length ? (
          visibleLines.map((line, index) => (
            <div key={`${index}-${line}`} className="log-line">
              <span className="log-line__number">{index + 1}</span>
              <code className="log-line__text">{line}</code>
            </div>
          ))
        ) : (
          <p className="empty-hint">표시할 로그가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
