// ── 서버 타입 ──────────────────────────────────────────────────────────────────
// DB의 servers 테이블과 API 응답에서 공통으로 사용하는 서버 관련 타입

export type ServerAuthType = "password" | "key" | "local";
export type ServerStatus   = "online" | "offline" | "error" | "unknown";

export type BastionConfig = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  credential: string;
};

export type BastionAuthType = BastionConfig["auth_type"];

// DB servers 테이블의 행 구조
export type ServerRow = {
  id:         string;          // slug: "local", "1a2b3c4d" 등
  name:       string;          // 표시 이름
  host:       string;          // IP 또는 호스트명
  port:       number;          // SSH 포트 (기본 22, local은 0)
  username:   string;          // SSH 사용자 이름
  auth_type:  ServerAuthType;  // 인증 방식
  credential: string;          // 비밀번호 또는 개인키 내용
  bastion_enabled: number;     // 0 or 1
  bastion_host: string;
  bastion_port: number;
  bastion_username: string;
  bastion_auth_type: BastionAuthType;
  bastion_credential: string;
  status:     ServerStatus;
  last_seen:  number | null;   // Unix epoch ms
  created_at: number;          // Unix epoch ms
};

// API 응답 — 자격증명 필드 제외 (보안상 클라이언트에 노출하지 않음)
export type ServerDTO = Omit<ServerRow, "credential" | "bastion_credential">;

// POST /api/servers 요청 본문
export type AddServerRequest = {
  name:       string;
  host:       string;
  port:       number;
  username:   string;
  auth_type:  "password" | "key";
  credential: string;
  bastion?: BastionConfig;
};

export type ServerConnectionTestResult = {
  ok: boolean;
  message: string;
};
