import { exec } from "./connection.manager";
import type { CollectorResult } from "../types/collector";

// ── 원격 메트릭 콜렉터 ────────────────────────────────────────────────────────
// SSH exec으로 /proc/ 파일을 직접 읽어 메트릭을 파싱
// systeminformation 라이브러리는 로컬 전용 — 원격은 proc 파일 직접 파싱
//
// 단일 SSH 명령으로 CPU + 메모리 + 디스크 + 네트워크를 한 번에 수집:
// 커넥션 오버헤드(채널 오픈/클로즈)를 최소화해 수집 지연을 줄임

// ── 델타 추적 (서버별) ──────────────────────────────────────────────────────────
// CPU: (idle, total)의 이전 값을 기억해 사용률(%) 계산
// 네트워크: (rx, tx bytes, ts)를 기억해 초당 전송량 계산
type CpuSnapshot  = { idle: number; total: number };
type NetSnapshot  = { rx: number; tx: number; ts: number };

const prevCpu = new Map<string, CpuSnapshot>();
const prevNet = new Map<string, Map<string, NetSnapshot>>(); // serverId → iface → snapshot

// 모든 메트릭을 한 번의 SSH exec으로 수집
const COLLECT_CMD = [
  "head -1 /proc/stat",
  "echo '##MEM##'",
  "cat /proc/meminfo",
  "echo '##DISK##'",
  "df -kP 2>/dev/null",
  "echo '##NET##'",
  "cat /proc/net/dev",
].join(" && ");

export async function collectRemoteMetrics(serverId: string): Promise<CollectorResult[]> {
  const raw = await exec(serverId, COLLECT_CMD);
  const ts  = Date.now();

  // 섹션 분리
  const [cpuSection = "", rest1 = ""] = raw.split("##MEM##");
  const [memSection = "", rest2 = ""] = rest1.split("##DISK##");
  const [diskSection = "", netSection = ""] = rest2.split("##NET##");

  const results: CollectorResult[] = [];

  results.push(...parseCpu(serverId, cpuSection.trim(), ts));
  results.push(...parseMem(memSection.trim(), ts));
  results.push(...parseDisk(diskSection.trim(), ts));
  results.push(...parseNet(serverId, netSection.trim(), ts));

  return results;
}

// ── CPU 파싱 ───────────────────────────────────────────────────────────────────
// /proc/stat 첫 줄: "cpu  user nice system idle iowait irq softirq steal ..."
// 사용률 = 1 - (delta_idle / delta_total)
function parseCpu(serverId: string, line: string, ts: number): CollectorResult[] {
  // "cpu  " 접두사 제거 후 공백 분리
  const parts = line.replace(/^cpu\s+/, "").split(/\s+/).map(Number);
  if (parts.length < 5 || parts.some(isNaN)) return [];

  const idle  = (parts[3] ?? 0) + (parts[4] ?? 0); // idle + iowait
  const total = parts.reduce((a, b) => a + b, 0);

  const prev = prevCpu.get(serverId);
  prevCpu.set(serverId, { idle, total });

  // 첫 번째 호출: 베이스라인만 저장, 값 없음
  if (!prev) {
    return [{ ok: true, collected: false, reason: "첫 번째 CPU 측정 — 베이스라인 저장" }];
  }

  const dIdle  = idle  - prev.idle;
  const dTotal = total - prev.total;

  if (dTotal <= 0) {
    return [{ ok: true, collected: false, reason: "CPU 델타가 0 이하" }];
  }

  const usage = Math.round((1 - dIdle / dTotal) * 10000) / 100;

  return [{ ok: true, collected: true, name: "cpu.usage_percent", value: usage, ts }];
}

// ── 메모리 파싱 ───────────────────────────────────────────────────────────────
// /proc/meminfo: "FieldName:   value kB" 형식
function parseMem(raw: string, ts: number): CollectorResult[] {
  const map: Record<string, number> = {};

  for (const line of raw.split("\n")) {
    const m = line.match(/^(\w+):\s+(\d+)/);
    if (m && m[1] != null) map[m[1]] = Number(m[2]); // 값은 kB 단위
  }

  const total     = map["MemTotal"]    ?? 0;
  const available = map["MemAvailable"] ?? 0;
  const swapTotal = map["SwapTotal"]   ?? 0;
  const swapFree  = map["SwapFree"]    ?? 0;

  if (total === 0) return [];

  const usedKB      = total - available;
  const usedPercent = Math.round((usedKB / total) * 10000) / 100;

  return [
    { ok: true, collected: true, name: "mem.used_percent",    value: usedPercent,      ts },
    { ok: true, collected: true, name: "mem.used_bytes",      value: usedKB * 1024,    ts },
    { ok: true, collected: true, name: "mem.available_bytes", value: available * 1024,  ts },
    { ok: true, collected: true, name: "mem.swap_used_bytes", value: (swapTotal - swapFree) * 1024, ts },
  ];
}

// ── 디스크 파싱 ───────────────────────────────────────────────────────────────
// df -kP 출력:
//   Filesystem  1K-blocks  Used  Available  Use%  Mounted on
//   /dev/sda1   488386584  ...               71%  /
//
// 가상 파일시스템(tmpfs, devtmpfs, udev 등) 제외
const VIRTUAL_FS_PREFIXES = ["tmpfs", "devtmpfs", "udev", "sysfs", "proc", "cgroup", "overlay"];

function sanitizeMount(mount: string): string {
  if (mount === "/") return "root";
  return mount.replace(/^\//, "").replace(/\//g, "_") || "unknown";
}

function parseDisk(raw: string, ts: number): CollectorResult[] {
  const results: CollectorResult[] = [];
  const lines = raw.split("\n").slice(1); // 헤더 제거

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    // Filesystem(0) 1K-blocks(1) Used(2) Available(3) Use%(4) Mounted(5)
    if (parts.length < 6) continue;

    const fs       = parts[0] ?? "";
    const used1K   = Number(parts[2]);
    const avail1K  = Number(parts[3]);
    const pctStr   = parts[4] ?? "";   // "71%"
    const mount    = parts[5] ?? "";

    // 가상 파일시스템 제외
    if (VIRTUAL_FS_PREFIXES.some((p) => fs.startsWith(p))) continue;
    // 숫자 파싱 오류 제외
    if (isNaN(used1K) || isNaN(avail1K)) continue;
    // 크기가 0인 파일시스템 제외 (마운트됐지만 용량 없는 가상 장치)
    if (used1K + avail1K === 0) continue;

    const pct   = Number(pctStr.replace("%", ""));
    const key   = sanitizeMount(mount);
    const total = (used1K + avail1K) * 1024;
    const used  = used1K * 1024;

    results.push(
      { ok: true, collected: true, name: `disk.${key}.used_percent`, value: pct,   ts },
      { ok: true, collected: true, name: `disk.${key}.used_bytes`,   value: used,  ts },
    );
  }

  return results;
}

// ── 네트워크 파싱 ──────────────────────────────────────────────────────────────
// /proc/net/dev:
//   Inter-| Receive ... | Transmit ...
//    face |bytes packets...| bytes packets...
//      lo: 12345 ...         12345 ...
//    eth0: 23456 ...         98765 ...
//
// bytes 필드: rx=col[1], tx=col[9] (0-indexed, 공백으로 분리)
function sanitizeIface(iface: string): string {
  return iface
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/, "")
    .slice(0, 20) || "unknown";
}

function parseNet(serverId: string, raw: string, ts: number): CollectorResult[] {
  const results: CollectorResult[] = [];
  const serverPrev = prevNet.get(serverId) ?? new Map<string, NetSnapshot>();

  const lines = raw.split("\n").slice(2); // 헤더 2줄 제거

  for (const line of lines) {
    if (!line.trim()) continue;

    // "  eth0: 12345 ..." → iface=eth0, bytes in remaining cols
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const iface  = line.slice(0, colonIdx).trim();
    const cols   = line.slice(colonIdx + 1).trim().split(/\s+/);

    // 루프백 제외
    if (iface === "lo") continue;

    const rxBytes = Number(cols[0]);
    const txBytes = Number(cols[8]);

    if (isNaN(rxBytes) || isNaN(txBytes)) continue;

    const ifaceKey = sanitizeIface(iface);
    const prev     = serverPrev.get(iface);

    serverPrev.set(iface, { rx: rxBytes, tx: txBytes, ts });

    if (!prev) continue; // 첫 수집: 베이스라인만 저장

    const dtMs = ts - prev.ts;
    if (dtMs <= 0) continue;

    const dtSec = dtMs / 1000;
    const rxSec = Math.max(0, (rxBytes - prev.rx) / dtSec);
    const txSec = Math.max(0, (txBytes - prev.tx) / dtSec);

    results.push(
      { ok: true, collected: true, name: `net.${ifaceKey}.rx_bytes_sec`, value: rxSec, ts },
      { ok: true, collected: true, name: `net.${ifaceKey}.tx_bytes_sec`, value: txSec, ts },
    );
  }

  prevNet.set(serverId, serverPrev);
  return results;
}
