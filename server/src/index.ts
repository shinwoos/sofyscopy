import { DB_PATH, PORT } from "./config/env";
import { startAllJobs } from "./jobs";
import { createApp } from "./app";

// ── 진입점 ─────────────────────────────────────────────────────────────────────
// 실행 순서:
//   1. config/env.ts   — DB 디렉토리 생성
//   2. db/client.ts    — SQLite 연결 + 스키마 초기화 (import 시점에 자동 실행)
//   3. createApp()     — Elysia 앱 생성 및 HTTP 서버 시작
//   4. startAllJobs()  — 백그라운드 job 시작 (CPU 수집, 데이터 prune)
//
// 스키마 초기화가 client.ts로 이동했으므로 별도 initSchema() 호출 불필요
// job 시작 실패는 수집 불가 상태이므로 process.exit(1)로 즉시 종료

const app = createApp().listen(PORT);

try {
  startAllJobs();
} catch (error) {
  console.error("failed to start jobs", error);
  process.exit(1);
}

console.log(`listening on http://localhost:${app.server?.port}`);
console.log(`db: ${DB_PATH}`);
