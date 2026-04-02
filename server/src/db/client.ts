import { Database } from "bun:sqlite";
import { DB_PATH } from "../config/env";

// ── SQLite 싱글턴 ──────────────────────────────────────────────────────────────
// 모듈이 처음 import될 때 한 번만 연결을 생성하고 이후 재사용
// 여러 파일에서 import해도 동일한 db 인스턴스를 공유함 (Bun 모듈 캐싱)

export const db = new Database(DB_PATH);

// WAL: 읽기와 쓰기를 동시에 처리 가능 (기본값은 쓰기 중 읽기 블로킹)
db.exec("PRAGMA journal_mode = WAL");
// NORMAL: WAL 모드에서 안전하면서 FULL 대비 쓰기 속도가 빠름
db.exec("PRAGMA synchronous = NORMAL");

function isDuplicateColumnError(error: unknown) {
  return (
    error instanceof Error &&
    /duplicate column name|already exists/i.test(error.message)
  );
}

// ── 스키마 초기화 ──────────────────────────────────────────────────────────────
// DB 연결과 동시에 테이블을 생성해 모듈 로딩 순서 문제를 방지
// repository의 db.prepare()는 이 파일을 import한 뒤 실행되므로
// 항상 테이블이 존재하는 상태가 보장됨

// ── servers 테이블 ─────────────────────────────────────────────────────────────
// credential 필드에 비밀번호 또는 개인키를 평문으로 저장 (개인용 로컬 앱)
// 원격 운영 환경에서는 암호화 필요
db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    host        TEXT    NOT NULL,
    port        INTEGER NOT NULL DEFAULT 22,
    username    TEXT    NOT NULL DEFAULT '',
    auth_type   TEXT    NOT NULL DEFAULT 'password',
    credential  TEXT    NOT NULL DEFAULT '',
    bastion_enabled    INTEGER NOT NULL DEFAULT 0,
    bastion_host       TEXT    NOT NULL DEFAULT '',
    bastion_port       INTEGER NOT NULL DEFAULT 22,
    bastion_username   TEXT    NOT NULL DEFAULT '',
    bastion_auth_type  TEXT    NOT NULL DEFAULT 'password',
    bastion_credential TEXT    NOT NULL DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'unknown',
    last_seen   INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  -- 로컬 서버는 항상 존재 (SSH 불필요, auth_type = 'local')
  INSERT OR IGNORE INTO servers (id, name, host, port, username, auth_type, credential, status)
  VALUES ('local', 'Local', 'localhost', 0, '', 'local', '', 'online');
`);

for (const statement of [
  "ALTER TABLE servers ADD COLUMN bastion_enabled INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE servers ADD COLUMN bastion_host TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE servers ADD COLUMN bastion_port INTEGER NOT NULL DEFAULT 22",
  "ALTER TABLE servers ADD COLUMN bastion_username TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE servers ADD COLUMN bastion_auth_type TEXT NOT NULL DEFAULT 'password'",
  "ALTER TABLE servers ADD COLUMN bastion_credential TEXT NOT NULL DEFAULT ''",
]) {
  try {
    db.exec(statement);
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error;
    }
  }
}

// ── metrics 테이블 ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS metrics (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT    NOT NULL DEFAULT 'local',
    name      TEXT    NOT NULL,
    value     REAL    NOT NULL,
    ts        INTEGER NOT NULL
  );
`);

// ── server_id 컬럼 마이그레이션 ────────────────────────────────────────────────
// 이미 metrics 테이블이 존재하는 경우 server_id 컬럼이 없을 수 있으므로
// ALTER TABLE로 추가 시도 (이미 있으면 silently 실패)
// 반드시 CREATE INDEX 전에 실행해야 server_id 컬럼이 보장됨
try {
  db.exec("ALTER TABLE metrics ADD COLUMN server_id TEXT NOT NULL DEFAULT 'local'");
} catch (error) {
  if (!isDuplicateColumnError(error)) {
    throw error;
  }
}

// ── 인덱스 생성 ────────────────────────────────────────────────────────────────
// 마이그레이션 이후에 생성해야 server_id 컬럼이 보장됨
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_metrics_lookup
    ON metrics(server_id, name, ts DESC);
`);
