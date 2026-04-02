import { CPU_COLLECT_INTERVAL_MS } from "../config/env";
import { collectCpuMetric } from "../collectors/cpu.collector";
import { persistCollectedMetric } from "../services/metrics.service";

// ── CPU 수집 Job ───────────────────────────────────────────────────────────────
// 역할: 수집 스케줄링 (타이머 관리)
// 수집 로직(cpu.collector)과 저장 로직(metrics.service)은 각 모듈에 위임
//
// systeminformation 교체 후 변경점:
//   - initCpuCollector() 제거 — 라이브러리가 내부적으로 베이스라인을 관리함
//   - startCpuJob이 async일 필요 없어졌지만 일관성을 위해 유지

export function startCpuJob() {
  setInterval(() => {
    void collectCpuMetric()
      .then((result) => {
        // collected: false인 경우 DB 저장 생략 (현재는 항상 true)
        persistCollectedMetric(result);
      })
      .catch((error) => {
        // systeminformation 호출 실패 시 — 로그만 남기고 다음 interval에서 재시도
        console.error("cpu collector failed", error);
      });
  }, CPU_COLLECT_INTERVAL_MS);
}
