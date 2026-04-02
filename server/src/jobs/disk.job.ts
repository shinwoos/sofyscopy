import { DISK_COLLECT_INTERVAL_MS } from "../config/env";
import { collectDiskMetrics } from "../collectors/disk.collector";
import { persistCollectedMetrics } from "../services/metrics.service";

// ── 디스크 수집 Job ────────────────────────────────────────────────────────────
// 10초 주기로 파일시스템별 사용량을 수집해 DB 저장 + WS 브로드캐스트
// 디스크 용량은 변화가 느리므로 수집 간격을 CPU/네트워크보다 길게 설정

export function startDiskJob() {
  setInterval(() => {
    void collectDiskMetrics()
      .then(persistCollectedMetrics)
      .catch((error) => {
        console.error("disk collector failed", error);
      });
  }, DISK_COLLECT_INTERVAL_MS);
}
