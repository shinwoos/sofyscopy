import { Client } from "ssh2";
import type { ConnectConfig } from "ssh2";
import { updateServerStatus } from "../db/servers.repository";
import { broadcastServerStatus } from "../services/ws.service";
import type { BastionAuthType, ServerRow } from "../types/server";

// ── SSH 연결 관리자 ────────────────────────────────────────────────────────────
// 원격 서버당 하나의 persistent SSH 연결을 유지
// 연결 끊김 시 지수 백오프로 재연결 시도

type ManagedConnection = {
  client: Client;
  bastionClient?: Client;
  ready: boolean;
  error: string | null;
};

// server_id → 연결 객체
const pool = new Map<string, ManagedConnection>();
// server_id → 재연결 타이머
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

const BASE_RECONNECT_MS  = 5_000;   // 첫 재연결 지연
const MAX_RECONNECT_MS   = 60_000;  // 최대 재연결 지연
const CONNECT_TIMEOUT_MS = 15_000;  // 연결 타임아웃

function logSsh(server: Pick<ServerRow, "id" | "name" | "host" | "port" | "username">, message: string) {
  console.log(
    `[ssh] ${message}: ${server.name} (${server.id}) ${server.username}@${server.host}:${server.port}`,
  );
}

function toConnectConfig(
  host: string,
  port: number,
  username: string,
  authType: ServerRow["auth_type"] | BastionAuthType,
  credential: string,
): ConnectConfig {
  const config: ConnectConfig = {
    host,
    port,
    username,
    readyTimeout: CONNECT_TIMEOUT_MS,
  };

  if (authType === "key") {
    config.privateKey = credential;
  } else {
    config.password = credential;
  }

  return config;
}

function connectClient(client: Client, config: ConnectConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    client
      .once("ready", () => resolve())
      .once("error", (error) => reject(error))
      .connect(config);
  });
}

// 서버에 SSH 연결을 수립하고 pool에 등록
// 연결 실패 시 reject — 호출자가 오류 메시지를 API 응답으로 반환
export function connect(server: ServerRow): Promise<void> {
  return new Promise((resolve, reject) => {
    // 기존 연결이 있으면 먼저 정리
    disconnect(server.id);
    logSsh(server, "connecting");

    const conn = new Client();
    const managed: ManagedConnection = { client: conn, ready: false, error: null };
    pool.set(server.id, managed);
    let aborted = false;

    const timeout = setTimeout(() => {
      logSsh(server, "timeout");
      aborted = true;
      managed.bastionClient?.destroy();
      conn.destroy();
      if (!resolved) {
        resolved = true;
        reject(new Error(`Connection to ${server.host} timed out`));
      }
    }, CONNECT_TIMEOUT_MS);

    let resolved = false;

    conn.on("ready", () => {
      clearTimeout(timeout);
      managed.ready = true;
      managed.error = null;
      logSsh(server, "ready");
      setStatus(server.id, "online");
      if (!resolved) { resolved = true; resolve(); }
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      managed.ready = false;
      managed.error = err.message;
      logSsh(server, `error - ${err.message}`);
      setStatus(server.id, "error");
      if (!resolved) { resolved = true; reject(err); }
      else {
        // 기존에 연결됐다가 오류 발생 → 재연결 예약
        scheduleReconnect(server, BASE_RECONNECT_MS);
      }
    });

    conn.on("close", () => {
      managed.ready = false;
      logSsh(server, "closed");
      if (resolved) {
        // 정상적으로 연결됐다가 끊어진 경우
        setStatus(server.id, "offline");
        scheduleReconnect(server, BASE_RECONNECT_MS);
      }
    });

    if (server.bastion_enabled === 1) {
      const bastionClient = new Client();
      managed.bastionClient = bastionClient;

      bastionClient.on("error", (error) => {
        logSsh(
          {
            id: `${server.id}:bastion`,
            name: `${server.name} bastion`,
            host: server.bastion_host,
            port: server.bastion_port,
            username: server.bastion_username,
          },
          `error - ${error.message}`,
        );
      });

      bastionClient.on("close", () => {
        logSsh(
          {
            id: `${server.id}:bastion`,
            name: `${server.name} bastion`,
            host: server.bastion_host,
            port: server.bastion_port,
            username: server.bastion_username,
          },
          "closed",
        );
      });

      logSsh(
        {
          id: `${server.id}:bastion`,
          name: `${server.name} bastion`,
          host: server.bastion_host,
          port: server.bastion_port,
          username: server.bastion_username,
        },
        "connecting",
      );

      connectClient(
        bastionClient,
        toConnectConfig(
          server.bastion_host,
          server.bastion_port,
          server.bastion_username,
          server.bastion_auth_type,
          server.bastion_credential,
        ),
      )
        .then(() => {
          logSsh(
            {
              id: `${server.id}:bastion`,
              name: `${server.name} bastion`,
              host: server.bastion_host,
              port: server.bastion_port,
              username: server.bastion_username,
            },
            "ready",
          );

          bastionClient.forwardOut(
            "127.0.0.1",
            0,
            server.host,
            server.port,
            (error, stream) => {
              if (aborted || resolved) {
                stream?.destroy();
                return;
              }

              if (error) {
                clearTimeout(timeout);
                managed.ready = false;
                managed.error = error.message;
                if (!resolved) {
                  resolved = true;
                  reject(error);
                }
                return;
              }

              const targetConfig = toConnectConfig(
                server.host,
                server.port,
                server.username,
                server.auth_type,
                server.credential,
              );
              targetConfig.sock = stream;
              conn.connect(targetConfig);
            },
          );
        })
        .catch((error) => {
          clearTimeout(timeout);
          managed.ready = false;
          managed.error = error instanceof Error ? error.message : String(error);
          logSsh(server, `bastion error - ${managed.error}`);
          setStatus(server.id, "error");
          if (!resolved) {
            resolved = true;
            reject(error);
          }
        });
    } else {
      conn.connect(
        toConnectConfig(
          server.host,
          server.port,
          server.username,
          server.auth_type,
          server.credential,
        ),
      );
    }
  });
}

// SSH exec 명령 실행 — stdout 전체를 문자열로 반환
// 연결이 끊어진 경우 Error를 throw
export function exec(serverId: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const managed = pool.get(serverId);
    if (!managed?.ready) {
      reject(new Error(`SSH not connected: ${serverId}`));
      return;
    }

    managed.client.exec(command, (err, stream) => {
      if (err) { reject(err); return; }

      let output = "";
      stream.on("data",   (data: Buffer) => { output += data.toString(); });
      stream.stderr.on("data", () => {});   // stderr 무시
      stream.on("close",  () => resolve(output));
      stream.on("error",  (e: Error) => reject(e));
    });
  });
}

// 특정 서버의 연결이 준비됐는지 확인
export function isConnected(serverId: string): boolean {
  return pool.get(serverId)?.ready === true;
}

// 연결 해제 및 pool에서 제거
export function disconnect(serverId: string) {
  const reconnect = reconnectTimers.get(serverId);
  if (reconnect) {
    clearTimeout(reconnect);
    reconnectTimers.delete(serverId);
  }

  const managed = pool.get(serverId);
  if (managed) {
    console.log(`[ssh] disconnect: ${serverId}`);
    managed.bastionClient?.destroy();
    managed.client.destroy();
    pool.delete(serverId);
  }
}

// 상태 변경: DB + WS 브로드캐스트
function setStatus(serverId: string, status: "online" | "offline" | "error") {
  updateServerStatus(serverId, status);
  broadcastServerStatus(serverId, status);
}

// 지수 백오프 재연결 예약
function scheduleReconnect(server: ServerRow, delayMs: number) {
  // 이미 예약된 타이머가 있으면 교체하지 않음
  if (reconnectTimers.has(server.id)) return;

  console.log(
    `[ssh] reconnect scheduled: ${server.name} (${server.id}) in ${delayMs}ms`,
  );

  const timer = setTimeout(async () => {
    reconnectTimers.delete(server.id);
    try {
      await connect(server);
    } catch {
      // 재연결 실패 → 더 긴 지연으로 다시 예약
      const nextDelay = Math.min(delayMs * 2, MAX_RECONNECT_MS);
      scheduleReconnect(server, nextDelay);
    }
  }, delayMs);

  reconnectTimers.set(server.id, timer);
}
