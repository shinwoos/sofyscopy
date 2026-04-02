import { MEMORY_COLLECT_INTERVAL_MS } from "../config/env";
import { collectMemoryMetrics } from "../collectors/memory.collector";
import { persistCollectedMetrics } from "../services/metrics.service";

// ── 메모리 수집 Job ────────────────────────────────────────────────────────────
// 5초 주기로 메모리 메트릭을 수집해 DB 저장 + WS 브로드캐스트
// 콜렉터가 CollectorResult[]를 반환하므로 persistCollectedMetrics(배열 버전) 사용

export function startMemoryJob() {
  setInterval(() => {
    void collectMemoryMetrics()
      .then(persistCollectedMetrics)
      .catch((error) => {
        console.error("memory collector failed", error);
      });
  }, MEMORY_COLLECT_INTERVAL_MS);
}
