import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ── 환경변수 및 전역 상수 ──────────────────────────────────────────────────────
// 모든 설정값을 이 파일에서 중앙 관리
// 값을 바꿀 때 이 파일만 수정하면 전체에 반영됨

// HTTP 서버 포트 — 환경변수 PORT가 없으면 3001 사용
export const PORT = Number(Bun.env.PORT ?? 3001);

// DB 디렉토리: ~/.devscope/
// 실행 위치와 무관하게 항상 동일한 경로를 참조하도록 절대 경로로 고정
export const DB_DIR = join(homedir(), ".devscope");
mkdirSync(DB_DIR, { recursive: true }); // 디렉토리가 없으면 자동 생성

// DB 파일 전체 경로 — client.ts와 index.ts에서 사용
export const DB_PATH = join(DB_DIR, "devscope.db");

// CPU 메트릭 이름 — DB에 저장되는 name 컬럼 값
export const CPU_METRIC_NAME = "cpu.usage_percent";

// CPU 수집 주기 (ms) — 부하가 빠르게 변하므로 2초
export const CPU_COLLECT_INTERVAL_MS = 2000;

// 메모리 수집 주기 (ms) — 5초 (CPU보다 변동이 느림)
export const MEMORY_COLLECT_INTERVAL_MS = 5000;

// 디스크 수집 주기 (ms) — 10초 (용량 변화는 매우 느림)
export const DISK_COLLECT_INTERVAL_MS = 10000;

// 네트워크 수집 주기 (ms) — 2초 (트래픽은 빠르게 변함)
export const NETWORK_COLLECT_INTERVAL_MS = 2000;
export const PROCESS_COLLECT_INTERVAL_MS = 5000;
export const CONTAINER_COLLECT_INTERVAL_MS = 5000;
export const PROCESS_TOP_N = 10;

// 로그 파일 조회 정책
// 기본값은 로컬/사설망 도구 성격에 맞춰 임의 경로 허용
// 외부 노출 모드로 바뀌면 false로 두고 allowlist를 사용하는 편이 안전
export const LOG_ALLOW_ANY_PATH = (Bun.env.LOG_ALLOW_ANY_PATH ?? "true") === "true";
export const LOG_ALLOWED_PATHS = (Bun.env.LOG_ALLOWED_PATHS ?? "/var/log")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// 데이터 prune 실행 주기 (ms) — 1시간마다 만료 데이터 삭제
export const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

// 메트릭 보관 기간 (ms) — 7일 초과 데이터는 prune 시 삭제
export const METRIC_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
