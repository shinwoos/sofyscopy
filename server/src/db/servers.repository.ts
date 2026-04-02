import { db } from "./client";
import type { ServerRow, ServerStatus } from "../types/server";

// ── Servers Repository ─────────────────────────────────────────────────────────
// servers 테이블 CRUD — prepared statement로 SQL injection 방지

const selectAllStatement = db.prepare(`
  SELECT id, name, host, port, username, auth_type, credential,
         bastion_enabled, bastion_host, bastion_port, bastion_username, bastion_auth_type, bastion_credential,
         status, last_seen, created_at
  FROM servers
  ORDER BY created_at ASC
`);

const selectByIdStatement = db.prepare(`
  SELECT id, name, host, port, username, auth_type, credential,
         bastion_enabled, bastion_host, bastion_port, bastion_username, bastion_auth_type, bastion_credential,
         status, last_seen, created_at
  FROM servers
  WHERE id = ?
`);

const insertServerStatement = db.prepare(`
  INSERT INTO servers (
    id, name, host, port, username, auth_type, credential,
    bastion_enabled, bastion_host, bastion_port, bastion_username, bastion_auth_type, bastion_credential,
    status, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', unixepoch() * 1000)
`);

const updateStatusStatement = db.prepare(`
  UPDATE servers
  SET status = ?, last_seen = ?
  WHERE id = ?
`);

const deleteServerStatement = db.prepare(`
  DELETE FROM servers WHERE id = ? AND id != 'local'
`);

// 모든 서버 조회
export function selectAllServers(): ServerRow[] {
  return selectAllStatement.all() as ServerRow[];
}

// 특정 서버 조회
export function selectServerById(id: string): ServerRow | null {
  return selectByIdStatement.get(id) as ServerRow | null;
}

type InsertServerParams = Pick<
  ServerRow,
  | "id"
  | "name"
  | "host"
  | "port"
  | "username"
  | "auth_type"
  | "credential"
  | "bastion_enabled"
  | "bastion_host"
  | "bastion_port"
  | "bastion_username"
  | "bastion_auth_type"
  | "bastion_credential"
>;

// 서버 추가
export function insertServer(params: InsertServerParams) {
  return insertServerStatement.run(
    params.id,
    params.name,
    params.host,
    params.port,
    params.username,
    params.auth_type,
    params.credential,
    params.bastion_enabled,
    params.bastion_host,
    params.bastion_port,
    params.bastion_username,
    params.bastion_auth_type,
    params.bastion_credential,
  );
}

// 서버 상태 갱신 — 연결 성공/실패 시 호출
export function updateServerStatus(id: string, status: ServerStatus) {
  return updateStatusStatement.run(status, status === "online" ? Date.now() : null, id);
}

// 서버 삭제 (로컬 서버는 삭제 불가)
export function deleteServer(id: string) {
  return deleteServerStatement.run(id);
}
