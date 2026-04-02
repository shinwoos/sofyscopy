import { Elysia } from "elysia";
import { CPU_METRIC_NAME } from "../config/env";
import { getLatestMetric, getRecentMetrics } from "../services/metrics.service";

// ── 메트릭 조회 라우트 ─────────────────────────────────────────────────────────
// DB에 저장된 메트릭을 읽어 반환하는 REST 엔드포인트
// 실제 데이터 조회는 metrics.service에 위임

export const metricsRoute = new Elysia()
  // GET /api/metrics/recent
  // 최근 20건을 ts DESC 순으로 반환 — 개발 중 DB 적재 확인용
  .get("/api/metrics/recent", () => {
    const rows = getRecentMetrics();
    return { ok: true, count: rows.length, rows };
  })

  // GET /api/metrics/latest
  // 특정 메트릭의 가장 최신값 1건 반환 — 현재는 CPU 고정
  // 추후 query param으로 메트릭 이름을 받아 확장 예정
  .get("/api/metrics/latest", () => {
    const metric = getLatestMetric(CPU_METRIC_NAME);
    return { ok: true, metric };
  });
