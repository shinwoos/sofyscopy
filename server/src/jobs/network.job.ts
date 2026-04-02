import { NETWORK_COLLECT_INTERVAL_MS } from "../config/env";
import { collectNetworkMetrics } from "../collectors/network.collector";
import { persistCollectedMetrics } from "../services/metrics.service";

// ── 네트워크 수집 Job ──────────────────────────────────────────────────────────
// 2초 주기로 인터페이스별 초당 송수신 바이트를 수집해 DB 저장 + WS 브로드캐스트
// CPU와 같은 주기: 네트워크 트래픽도 빠르게 변하므로 짧은 간격이 유효

export function startNetworkJob() {
  setInterval(() => {
    void collectNetworkMetrics()
      .then(persistCollectedMetrics)
      .catch((error) => {
        console.error("network collector failed", error);
      });
  }, NETWORK_COLLECT_INTERVAL_MS);
}
