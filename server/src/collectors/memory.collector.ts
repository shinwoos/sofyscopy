import si from "systeminformation";
import type { CollectorResult } from "../types/collector";

// ── 메모리 콜렉터 ──────────────────────────────────────────────────────────────
// si.mem() 한 번 호출로 4개 메트릭을 동시 생성
// 시스템 콜을 4번 나눠 호출하지 않는 이유: si.mem()은 내부적으로 /proc/meminfo(Linux)
// 또는 Windows API를 한 번만 읽어 모든 필드를 채움 — 분리해도 실제로는 같은 비용

// used_percent 계산 방식: (total - available) / total * 100
// ❌ used / total: Linux에서 used = total - free이고, free ≠ available
//    (buffers/cache를 제외하지 않아 실제 사용 가능 메모리보다 낮게 표시됨)
// ✅ (total - available) / total: OS가 실제로 애플리케이션에 줄 수 없는 메모리 비율
//    systeminformation의 available은 free + reclaimable(캐시)을 합산한 값

export async function collectMemoryMetrics(): Promise<CollectorResult[]> {
  const mem = await si.mem();
  const ts = Date.now();

  // total이 0이면 division by zero 방지
  const usedPercent =
    mem.total > 0
      ? Math.round(((mem.total - mem.available) / mem.total) * 10000) / 100
      : 0;

  return [
    { ok: true, collected: true, name: "mem.used_percent",    value: usedPercent,   ts },
    { ok: true, collected: true, name: "mem.used_bytes",      value: mem.used,      ts },
    { ok: true, collected: true, name: "mem.available_bytes", value: mem.available, ts },
    { ok: true, collected: true, name: "mem.swap_used_bytes", value: mem.swapused,  ts },
  ];
}
