import si from "systeminformation";
import type { CollectorResult } from "../types/collector";

// ── 디스크 콜렉터 ──────────────────────────────────────────────────────────────
// si.fsSize()로 파일시스템별 사용량을 수집
// 디스크 I/O(초당 읽기·쓰기 바이트)는 이 콜렉터에서 제외:
//   si.disksIO()는 블록 디바이스(sda, nvme0n1) 단위로 반환되는데
//   파일시스템 마운트와 1:1 매핑이 안 돼 혼용하면 혼란스럽고,
//   RAID·LVM 환경에서는 디바이스 이름도 달라짐

// 마운트 포인트를 메트릭 이름에 안전하게 쓸 수 있는 키로 변환
// 이유: 메트릭 이름에 ":"나 "/"가 들어가면 파싱·표시에서 오해 가능
//   Windows "C:" → "C"
//   Linux "/"   → "root"  (빈 문자열 방지)
//   Linux "/var/log" → "var_log"
function sanitizeMount(mount: string): string {
  // Windows 드라이브 레터: "C:" → "C"
  if (/^[A-Za-z]:$/.test(mount)) return (mount[0] ?? "X").toUpperCase();

  // Linux/Mac 루트
  if (mount === "/") return "root";

  // 앞의 "/"를 제거하고 나머지 "/"를 "_"로 치환
  return mount.replace(/^\//, "").replace(/\//g, "_") || "unknown";
}

export async function collectDiskMetrics(): Promise<CollectorResult[]> {
  const filesystems = await si.fsSize();
  const ts = Date.now();

  const results: CollectorResult[] = [];

  for (const fs of filesystems) {
    // size === 0인 항목은 tmpfs, devtmpfs 등 가상 파일시스템
    // 실제 용량이 없는 항목을 표시해봐야 의미 없으므로 제외
    if (fs.size === 0) continue;

    const mountKey = sanitizeMount(fs.mount);

    // si.fsSize()의 use 필드는 이미 (used/size * 100)으로 계산된 퍼센트
    // 직접 계산하면 소수점 오차가 다를 수 있어 라이브러리 값을 그대로 사용
    const usedPercent = Math.round(fs.use * 100) / 100;

    results.push(
      { ok: true, collected: true, name: `disk.${mountKey}.used_percent`, value: usedPercent, ts },
      { ok: true, collected: true, name: `disk.${mountKey}.used_bytes`,   value: fs.used,     ts },
    );
  }

  return results;
}
