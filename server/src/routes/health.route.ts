import { Elysia } from "elysia";

// ── 헬스체크 라우트 ────────────────────────────────────────────────────────────
// GET /health
// 서버가 살아있는지 확인하는 엔드포인트
// 로드밸런서, 모니터링 도구, /canary 스킬 등에서 생존 여부를 판단할 때 사용
export const healthRoute = new Elysia().get("/health", () => ({ ok: true }));
