import si from "systeminformation";
import type { CollectorResult } from "../types/collector";

// ── 네트워크 콜렉터 ────────────────────────────────────────────────────────────
// si.networkStats()로 인터페이스별 초당 송수신 바이트를 수집
//
// rx_sec / tx_sec는 라이브러리가 내부적으로 이전 호출과의 차분을 계산해 반환
// 따라서 첫 번째 호출에서는 null 또는 -1이 올 수 있음 → Math.max(0, ...)로 방어
//
// 인터페이스 이름 정규화 이유:
//   Windows: "Intel(R) Wi-Fi 6 AX201" 같이 공백·괄호·특수문자가 포함될 수 있음
//   그대로 메트릭 이름에 쓰면 쿼리·표시에서 문제가 생기므로 영숫자+_만 허용
//   너무 길어지면 20자로 잘라서 가독성 확보

function sanitizeIface(iface: string): string {
  return iface
    .replace(/[^a-zA-Z0-9]/g, "_") // 영숫자 외 문자 → "_"
    .replace(/_+/g, "_")           // 연속 "_" 하나로 압축
    .replace(/^_|_$/g, "")         // 앞뒤 "_" 제거
    .slice(0, 20)                   // 최대 20자
    || "unknown";
}

export async function collectNetworkMetrics(): Promise<CollectorResult[]> {
  // "*"를 전달하면 모든 인터페이스 통계를 한 번에 반환
  const stats = await si.networkStats("*");
  const ts = Date.now();

  const results: CollectorResult[] = [];

  for (const stat of stats) {
    // 루프백(lo) 제외: 로컬 통신이라 외부 네트워크 활동과 무관
    // "Loopback"이 포함된 이름(Windows)도 함께 제외
    if (
      stat.iface === "lo" ||
      stat.iface.toLowerCase().includes("loopback")
    ) {
      continue;
    }

    const ifaceKey = sanitizeIface(stat.iface);

    // rx_sec / tx_sec: 초당 바이트. 첫 호출 또는 측정 불가 시 null/-1
    const rx = Math.max(0, stat.rx_sec ?? 0);
    const tx = Math.max(0, stat.tx_sec ?? 0);

    results.push(
      { ok: true, collected: true, name: `net.${ifaceKey}.rx_bytes_sec`, value: rx, ts },
      { ok: true, collected: true, name: `net.${ifaceKey}.tx_bytes_sec`, value: tx, ts },
    );
  }

  return results;
}
