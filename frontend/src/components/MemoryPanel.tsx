import { useMetricEntry } from "../hooks/useServerMetrics";
import { GaugeChart }     from "./GaugeChart";

// ── 메모리 패널 ────────────────────────────────────────────────────────────────
// 큰 게이지로 사용률을 직관적으로 표시 + 상세 수치는 하단 stat 카드로
// useMetricEntry 훅이 server_id 전환을 투명하게 처리

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function MemoryPanel() {
  const usedPct    = useMetricEntry("mem.used_percent")?.latest    ?? null;
  const usedBytes  = useMetricEntry("mem.used_bytes")?.latest      ?? null;
  const availBytes = useMetricEntry("mem.available_bytes")?.latest ?? null;
  const swapBytes  = useMetricEntry("mem.swap_used_bytes")?.latest ?? null;
  const totalBytes = usedBytes !== null && availBytes !== null
    ? usedBytes + availBytes
    : null;
  const memorySummary = usedBytes !== null && totalBytes !== null
    ? `${formatBytes(usedBytes)} / ${formatBytes(totalBytes)}`
    : "—";

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Memory</p>
          <h2 className="panel-title">RAM Usage</h2>
        </div>

        <div className="memory-header-summary" aria-label="사용 중 메모리와 총 메모리">
          <span className="memory-header-summary__label">Used / Total</span>
          <strong className="memory-header-summary__value">{memorySummary}</strong>
        </div>
      </div>

      {/* 게이지 — 데이터 도착 전엔 스켈레톤 표시 */}
      <div className="gauge-center-wrap">
        {usedPct === null
          ? <div className="gauge-skeleton" style={{ width: 150, height: 150 }} />
          : <GaugeChart value={usedPct} size={150} />
        }
      </div>

      {/* 상세 수치 카드 */}
      <div className="stats-row" style={{ marginTop: 16, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="stat-card">
          <span className="stat-label">Used</span>
          <strong className="stat-value">{usedBytes === null ? "—" : formatBytes(usedBytes)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Available</span>
          <strong className="stat-value">{availBytes === null ? "—" : formatBytes(availBytes)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Swap Used</span>
          <strong className="stat-value">{swapBytes === null ? "—" : formatBytes(swapBytes)}</strong>
        </div>
      </div>
    </div>
  );
}
