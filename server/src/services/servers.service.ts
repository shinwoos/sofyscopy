import {
  deleteServer,
  insertServer,
  selectAllServers,
  selectServerById,
  updateServerStatus,
} from "../db/servers.repository";
import { startRemoteJob, stopRemoteJob } from "../jobs/remote.job";
import { connect, disconnect } from "../ssh/connection.manager";
import type {
  AddServerRequest,
  ServerConnectionTestResult,
  ServerDTO,
  ServerRow,
} from "../types/server";

function toServerDTO(row: ServerRow): ServerDTO {
  const { credential: _credential, bastion_credential: _bastionCredential, ...dto } = row;
  return dto;
}

function createServerId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRequest(request: AddServerRequest): AddServerRequest {
  const normalized = {
    name: request.name.trim(),
    host: request.host.trim(),
    port: request.port,
    username: request.username.trim(),
    auth_type: request.auth_type,
    credential: request.credential.trim(),
    bastion: request.bastion?.enabled
      ? {
          enabled: true,
          host: request.bastion.host.trim(),
          port: request.bastion.port,
          username: request.bastion.username.trim(),
          auth_type: request.bastion.auth_type,
          credential: request.bastion.credential.trim(),
        }
      : undefined,
  };

  if (
    normalized.bastion?.enabled &&
    (!normalized.bastion.host ||
      !normalized.bastion.username ||
      !normalized.bastion.credential)
  ) {
    throw new Error("배스천 설정이 비어 있습니다");
  }

  return normalized;
}

export function listServers(): ServerDTO[] {
  return selectAllServers().map(toServerDTO);
}

export async function testServerConnection(
  request: AddServerRequest,
): Promise<ServerConnectionTestResult> {
  const normalized = normalizeRequest(request);
  const tempServer: ServerRow = {
    id: "__test__",
    name: normalized.name,
    host: normalized.host,
    port: normalized.port,
    username: normalized.username,
    auth_type: normalized.auth_type,
    credential: normalized.credential,
    bastion_enabled: normalized.bastion?.enabled ? 1 : 0,
    bastion_host: normalized.bastion?.host ?? "",
    bastion_port: normalized.bastion?.port ?? 22,
    bastion_username: normalized.bastion?.username ?? "",
    bastion_auth_type: normalized.bastion?.auth_type ?? "password",
    bastion_credential: normalized.bastion?.credential ?? "",
    status: "unknown",
    last_seen: null,
    created_at: Date.now(),
  };

  try {
    await connect(tempServer);
    disconnect(tempServer.id);

    return {
      ok: true,
      message: "SSH connection successful",
    };
  } catch (error) {
    disconnect(tempServer.id);

    return {
      ok: false,
      message: error instanceof Error ? error.message : "SSH connection failed",
    };
  }
}

export async function registerServer(request: AddServerRequest): Promise<ServerDTO> {
  const normalized = normalizeRequest(request);
  const serverId = createServerId();

  insertServer({
    id: serverId,
    name: normalized.name,
    host: normalized.host,
    port: normalized.port,
    username: normalized.username,
    auth_type: normalized.auth_type,
    credential: normalized.credential,
    bastion_enabled: normalized.bastion?.enabled ? 1 : 0,
    bastion_host: normalized.bastion?.host ?? "",
    bastion_port: normalized.bastion?.port ?? 22,
    bastion_username: normalized.bastion?.username ?? "",
    bastion_auth_type: normalized.bastion?.auth_type ?? "password",
    bastion_credential: normalized.bastion?.credential ?? "",
  });

  const server = selectServerById(serverId);
  if (!server) {
    throw new Error("Failed to create server record");
  }

  try {
    await connect(server);
    updateServerStatus(serverId, "online");
    startRemoteJob(server);
    return toServerDTO(selectServerById(serverId) ?? server);
  } catch (error) {
    disconnect(serverId);
    deleteServer(serverId);
    throw error;
  }
}

export function removeServerById(id: string) {
  if (id === "local") {
    throw new Error("로컬 서버는 삭제할 수 없습니다");
  }

  const server = selectServerById(id);
  if (!server) {
    throw new Error("서버를 찾을 수 없습니다");
  }

  stopRemoteJob(id);
  disconnect(id);
  deleteServer(id);
}
