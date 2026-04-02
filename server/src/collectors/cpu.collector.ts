import si from "systeminformation";
import { CPU_METRIC_NAME } from "../config/env";
import type { CollectorResult } from "../types/collector";

// ── CPU 콜렉터 ─────────────────────────────────────────────────────────────────
// systeminformation 라이브러리를 사용해 CPU 사용률을 수집
// Windows / Linux / Mac 크로스플랫폼으로 동작
//
// 기존 /proc/stat 직접 파싱 방식에서 교체:
//   - 델타 계산, 스냅샷 관리 등 플랫폼별 로직을 라이브러리에 위임
//   - si.currentLoad()가 내부적으로 이전값과의 차이를 계산해 % 반환

// CPU 사용률을 수집해 CollectorResult로 반환
// DB 저장과 WS 브로드캐스트는 metrics.service가 담당
export async function collectCpuMetric(): Promise<CollectorResult> {
  const load = await si.currentLoad();

  return {
    ok: true,
    collected: true,
    name: CPU_METRIC_NAME,
    // currentLoad: 전체 CPU 사용률 (0~100), 소수점 2자리로 반올림
    value: Math.round(load.currentLoad * 100) / 100,
    ts: Date.now(),
  };
}
