import { useEffect, useState } from "react";
import { useMetricsStore } from "./store/metricsStore";
import { useProcessStore } from "./store/processStore";
import { useUiStore }      from "./store/uiStore";
import { useServerStore }  from "./store/serverStore";
import { Sidebar }    from "./components/Sidebar";
import { TopBar }     from "./components/TopBar";
import { CpuPanel }   from "./components/CpuPanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { DiskPanel }  from "./components/DiskPanel";
import { NetworkPanel } from "./components/NetworkPanel";
import { ProcessPanel } from "./components/ProcessPanel";
import { ContainerPanel } from "./components/ContainerPanel";
import type { Server, ServerStatus } from "./store/serverStore";
import type { ContainerSnapshot, ProcessSnapshot } from "./types/process";

// ── WebSocket 메시지 유니온 타입 ──────────────────────────────────────────────
type WsMessage =
  | { type: "connected";     message: string }
  | { type: "metric";        metric: { server_id: string; name: string; value: number; ts: number } }
  | { type: "server_status"; server_id: string; status: ServerStatus }
  | { type: "process_update"; snapshot: ProcessSnapshot }
  | { type: "container_update"; snapshot: ContainerSnapshot };

// 개발 모드: Vite WS 프록시와 Bun 네이티브 WS 호환 문제로 :3001에 직접 연결
// 프로덕션: 서버가 프론트엔드를 서빙하므로 같은 호스트로 연결
const WS_URL = import.meta.env.DEV
  ? "ws://localhost:3001/ws"
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

const WS_RECONNECT_DELAY_MS     = 2_000;
const WS_RECONNECT_MAX_DELAY_MS = 30_000;

export default function App() {
  const [status, setStatus] = useState("connecting");
  const pushPoint      = useMetricsStore((s) => s.pushPoint);
  const setProcessSnapshot = useProcessStore((s) => s.setProcessSnapshot);
  const setContainerSnapshot = useProcessStore((s) => s.setContainerSnapshot);
  const sidebarOpen    = useUiStore((s) => s.sidebarOpen);
  const setServers     = useServerStore((s) => s.setServers);
  const updateStatus   = useServerStore((s) => s.updateServerStatus);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const servers        = useServerStore((s) => s.servers);
  const activeServer   = servers.find((server) => server.id === activeServerId) ?? null;
  const latestCpu = useMetricsStore((s) => s.entries[activeServerId]?.["cpu.usage_percent"]?.latest ?? null);
  const latestMemory = useMetricsStore((s) => s.entries[activeServerId]?.["mem.used_percent"]?.latest ?? null);
  const processCount = useProcessStore((s) => s.processSnapshots[activeServerId]?.processes.length ?? 0);
  const containerCount = useProcessStore((s) => s.containerSnapshots[activeServerId]?.containers.length ?? 0);

  // ── 서버 목록 초기 로드 ──────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchServers() {
      try {
        const res  = await fetch("/api/servers");
        const data = await res.json() as Array<Record<string, unknown>>;
        const servers: Server[] = data.map((s) => ({
          id:       s.id       as string,
          name:     s.name     as string,
          host:     s.host     as string,
          port:     s.port     as number,
          username: s.username as string,
          status:   (s.status  as ServerStatus) ?? "unknown",
        }));
        setServers(servers);
      } catch {
        // 서버를 불러오지 못한 경우 로컬 서버만 표시
        setServers([{ id: "local", name: "Local", host: "localhost", port: 0, username: "", status: "online" }]);
      }
    }
    void fetchServers();
  }, [setServers]);

  // ── WebSocket 연결 및 지수 백오프 재연결 ────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let delay    = WS_RECONNECT_DELAY_MS;
    let destroyed = false;

    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setStatus("connected");
        delay = WS_RECONNECT_DELAY_MS;
      };

      ws.onclose = () => {
        if (destroyed) return;
        setStatus("disconnected");
        reconnectTimeout = setTimeout(() => {
          if (!destroyed) connect();
        }, delay);
        delay = Math.min(delay * 2, WS_RECONNECT_MAX_DELAY_MS);
      };

      ws.onerror = () => {
        setStatus("error");
      };

      ws.onmessage = (event) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(event.data as string) as WsMessage;
        } catch {
          console.warn("invalid ws message", event.data);
          return;
        }

        if (msg.type === "metric") {
          pushPoint(msg.metric.server_id, msg.metric.name, msg.metric.value, msg.metric.ts);
        } else if (msg.type === "server_status") {
          updateStatus(msg.server_id, msg.status);
        } else if (msg.type === "process_update") {
          setProcessSnapshot(msg.snapshot);
        } else if (msg.type === "container_update") {
          setContainerSnapshot(msg.snapshot);
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws.close();
    };
  }, [pushPoint, updateStatus, setProcessSnapshot, setContainerSnapshot]);

  return (
    <div className={`app-root ${sidebarOpen ? "app-root--sidebar-open" : ""}`}>
      {/* 사이드바 */}
      <Sidebar />

      {/* 메인 영역 */}
      <div className="main-area">
        <TopBar
          status={status}
          activeServerName={activeServer?.name ?? "Local"}
          activeServerHost={activeServer?.id === "local" ? "localhost" : `${activeServer?.host ?? "unknown"}:${activeServer?.port ?? 0}`}
        />

        <div className="dashboard-content">
          <section className="overview-strip">
            <div className="overview-hero">
              <p className="overview-kicker">Active Target</p>
              <h1 className="overview-title">{activeServer?.name ?? "Local Server"}</h1>
              <p className="overview-caption">
                {activeServer?.id === "local"
                  ? "로컬 시스템 리소스와 런타임 상태를 한 화면에서 관측합니다."
                  : `${activeServer?.host}:${activeServer?.port} 원격 서버를 실시간으로 추적하고 있습니다.`}
              </p>
            </div>

            <div className="overview-cards">
              <div className="overview-card">
                <span className="overview-card__label">CPU</span>
                <strong className="overview-card__value">
                  {latestCpu === null ? "—" : `${latestCpu.toFixed(1)}%`}
                </strong>
              </div>
              <div className="overview-card">
                <span className="overview-card__label">Memory</span>
                <strong className="overview-card__value">
                  {latestMemory === null ? "—" : `${latestMemory.toFixed(1)}%`}
                </strong>
              </div>
              <div className="overview-card">
                <span className="overview-card__label">Processes</span>
                <strong className="overview-card__value">{processCount}</strong>
              </div>
              <div className="overview-card">
                <span className="overview-card__label">Containers</span>
                <strong className="overview-card__value">{containerCount}</strong>
              </div>
            </div>
          </section>

          <div className="dashboard-grid">
            <CpuPanel />
            <MemoryPanel />
            <DiskPanel />
            <NetworkPanel />
            <ProcessPanel />
            <ContainerPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
