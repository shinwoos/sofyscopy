import { Elysia } from "elysia";
import { join } from "node:path";
import { healthRoute } from "./routes/health.route";
import { metricsRoute } from "./routes/metrics.route";
import { wsRoute } from "./routes/ws.route";
import { serversRoute } from "./routes/servers.route";

// 프론트엔드 빌드 결과물 경로
// import.meta.dir = 현재 파일(app.ts)이 위치한 src/ 디렉토리
const FRONTEND_DIST = join(import.meta.dir, "../../frontend/dist");

// ── Elysia 앱 팩토리 ───────────────────────────────────────────────────────────
export function createApp() {
  return new Elysia()
    .use(healthRoute)   // GET /health
    .use(metricsRoute)  // GET /api/metrics/*
    .use(wsRoute)       // WS  /ws
    .use(serversRoute)  // GET/POST/DELETE /api/servers

    // ── 정적 파일 서빙 ──────────────────────────────────────────────────────────
    // @elysiajs/static 대신 Bun.file()로 직접 서빙
    // Windows 경로 호환성 문제를 피하고 동작을 명확히 제어할 수 있음

    // 루트 → index.html
    .get("/", () => Bun.file(join(FRONTEND_DIST, "index.html")))

    // /assets/* → Vite가 번들한 JS, CSS 파일
    .get("/assets/*", ({ params }) =>
      Bun.file(join(FRONTEND_DIST, "assets", params["*"])),
    )

    // SPA 폴백 → 나머지 모든 경로에 index.html 반환
    // React 클라이언트 라우팅 시 /dashboard 같은 경로로 직접 접근해도 동작하게 함
    .get("/*", () => Bun.file(join(FRONTEND_DIST, "index.html")));
}
