import { posix as pathPosix } from "node:path";
import { LOG_ALLOWED_PATHS, LOG_ALLOW_ANY_PATH } from "../config/env";
import { selectServerById } from "../db/servers.repository";
import { execWithStatus } from "../ssh/connection.manager";
import type { LogEntry, LogQuery, LogResult, LogSourceType, ResolvedLogQuery } from "../types/log";

const MIN_LOG_LINES = 10;
const MAX_LOG_LINES = 500;
const LOCAL_LOG_TIMEOUT_MS = 15_000;

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function clampLines(lines: number) {
  if (!Number.isFinite(lines)) {
    return 100;
  }

  return Math.max(MIN_LOG_LINES, Math.min(MAX_LOG_LINES, Math.trunc(lines)));
}

function normalizeTarget(target?: string) {
  const trimmed = target?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeLogPath(target: string) {
  if (!target.startsWith("/")) {
    throw new Error("file 로그 조회는 절대 경로만 허용합니다");
  }

  const normalized = pathPosix.normalize(target);
  if (LOG_ALLOW_ANY_PATH) {
    return normalized;
  }

  if (LOG_ALLOWED_PATHS.some((root) => normalized === root || normalized.startsWith(`${root}/`))) {
    return normalized;
  }

  throw new Error(`${LOG_ALLOWED_PATHS.join(", ")} 하위 경로만 조회할 수 있습니다`);
}

function buildFileLogCommand(path: string, lines: number) {
  const escapedPath = shellEscape(path);

  if (LOG_ALLOW_ANY_PATH) {
    return `tail -n ${lines} -- ${escapedPath}`;
  }

  const allowedCases = LOG_ALLOWED_PATHS
    .map((root) => `${shellEscape(root)}/*`)
    .join(" | ");

  return [
    `resolved_path=$(readlink -f -- ${escapedPath})`,
    `[ -n "$resolved_path" ]`,
    `case "$resolved_path" in ${allowedCases}) ;; *) echo '${LOG_ALLOWED_PATHS.join(", ")} 하위 경로만 조회할 수 있습니다' >&2; exit 1 ;; esac`,
    `tail -n ${lines} -- "$resolved_path"`,
  ].join(" && ");
}

function buildRecentLogCommand(source: LogSourceType, lines: number, target?: string) {
  if (source === "file") {
    if (!target) {
      throw new Error("file 로그 조회에는 파일 경로가 필요합니다");
    }

    const normalizedPath = normalizeLogPath(target);
    return buildFileLogCommand(normalizedPath, lines);
  }

  if (source === "journal") {
    if (!target) {
      return `journalctl -n ${lines} --no-pager`;
    }

    return `journalctl -n ${lines} --no-pager -u ${shellEscape(target)}`;
  }

  if (!target) {
    throw new Error("docker 로그 조회에는 컨테이너 이름 또는 ID가 필요합니다");
  }

  return `docker logs --tail ${lines} ${shellEscape(target)} 2>&1`;
}

export function resolveLogQuery(query: LogQuery): ResolvedLogQuery {
  return {
    server_id: query.server_id.trim() || "local",
    source: query.source,
    target: normalizeTarget(query.target),
    lines: clampLines(query.lines),
  };
}

export function buildFollowLogCommand(query: ResolvedLogQuery) {
  if (query.source === "file") {
    if (!query.target) {
      throw new Error("file 로그 조회에는 파일 경로가 필요합니다");
    }

    const normalizedPath = normalizeLogPath(query.target);
    const escapedPath = shellEscape(normalizedPath);

    if (LOG_ALLOW_ANY_PATH) {
      return `tail -n 0 -F -- ${escapedPath}`;
    }

    const allowedCases = LOG_ALLOWED_PATHS
      .map((root) => `${shellEscape(root)}/*`)
      .join(" | ");

    return [
      `resolved_path=$(readlink -f -- ${escapedPath})`,
      `[ -n "$resolved_path" ]`,
      `case "$resolved_path" in ${allowedCases}) ;; *) echo '${LOG_ALLOWED_PATHS.join(", ")} 하위 경로만 조회할 수 있습니다' >&2; exit 1 ;; esac`,
      `tail -n 0 -F -- "$resolved_path"`,
    ].join(" && ");
  }

  if (query.source === "journal") {
    if (!query.target) {
      return "journalctl -n 0 -f --no-pager";
    }

    return `journalctl -n 0 -f --no-pager -u ${shellEscape(query.target)}`;
  }

  if (!query.target) {
    throw new Error("docker 로그 조회에는 컨테이너 이름 또는 ID가 필요합니다");
  }

  return `docker logs -f --tail 0 ${shellEscape(query.target)} 2>&1`;
}

async function execLocal(command: string) {
  const process = Bun.spawn({
    cmd: ["bash", "-lc", command],
    stdout: "pipe",
    stderr: "pipe",
  });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    process.kill();
  }, LOCAL_LOG_TIMEOUT_MS);

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);

    if (timedOut) {
      throw new Error("로컬 로그 조회 시간이 초과되었습니다");
    }

    if (exitCode !== 0) {
      const message = stderr.trim() || stdout.trim() || "로컬 로그 조회에 실패했습니다";
      throw new Error(message);
    }

    return stdout;
  } finally {
    clearTimeout(timeout);
  }
}

function parseLogLines(raw: string): LogEntry[] {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((text, index) => ({
      line_number: index + 1,
      text,
    }));
}

export async function getRecentLogs(query: LogQuery): Promise<LogResult> {
  const resolved = resolveLogQuery(query);
  const command = buildRecentLogCommand(resolved.source, resolved.lines, resolved.target);

  if (resolved.server_id !== "local" && !selectServerById(resolved.server_id)) {
    throw new Error("서버를 찾을 수 없습니다");
  }

  const raw = resolved.server_id === "local"
    ? await execLocal(command)
    : await execWithStatus(resolved.server_id, command).then((result) => {
        if (result.code !== 0) {
          const message = result.stderr.trim() || result.stdout.trim() || "원격 로그 조회에 실패했습니다";
          throw new Error(message);
        }
        return result.stdout;
      });

  return {
    ok: true,
    server_id: resolved.server_id,
    source: resolved.source,
    target: resolved.target ?? null,
    lines_requested: resolved.lines,
    lines: parseLogLines(raw),
  };
}
