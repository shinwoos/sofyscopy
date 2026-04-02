import { PRUNE_INTERVAL_MS } from "../config/env";
import { pruneExpiredMetrics } from "../services/metrics.service";

// ── Prune Job ──────────────────────────────────────────────────────────────────
// 보관 기간(7일)이 지난 메트릭을 주기적으로 삭제
// DB가 무한 증가하지 않도록 유지하는 역할
//
// 실행 주기: 1시간 (PRUNE_INTERVAL_MS)
// 삭제 기준: 현재 시각 - METRIC_RETENTION_MS(7일) 보다 오래된 ts 값

export function startPruneJob() {
  setInterval(() => {
    pruneExpiredMetrics();
  }, PRUNE_INTERVAL_MS);
}
