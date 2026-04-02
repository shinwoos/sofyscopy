import {
  CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useServerMetrics } from "../hooks/useServerMetrics";
import { useUiStore }       from "../store/uiStore";

// ── 네트워크 패널 ──────────────────────────────────────────────────────────────
// 인터페이스 이름이 런타임에 결정되므로 store 키를 prefix 스캔으로 동적 탐색
// 첫 번째 활성 인터페이스의 rx/tx를 하나의 차트에 두 라인으로 표시
// useServerMetrics 훅으로 활성 서버의 메트릭을 조회

function formatBytesPerSec(bps: number): string {
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  if (bps >= 1024)      return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

export function NetworkPanel() {
  const entries = useServerMetrics();
  const theme   = useUiStore((s) => s.theme);

  const ifaces = Object.keys(entries)
    .filter((k) => k.startsWith("net.") && k.endsWith(".rx_bytes_sec"))
    .map((k) => k.split(".").slice(1, -1).join("."));

  const iface    = ifaces[0];
  const rxEntry  = iface ? entries[`net.${iface}.rx_bytes_sec`] : undefined;
  const txEntry  = iface ? entries[`net.${iface}.tx_bytes_sec`] : undefined;
  const rxLatest = rxEntry?.latest ?? null;
  const txLatest = txEntry?.latest ?? null;

  // tx를 time 키로 Map에 올려두고 rx 포인트와 병합
  // 인덱스 기반으로 하면 한쪽 수집이 실패해 개수가 달라질 때 데이터가 어긋남
  const txByTime = new Map((txEntry?.points ?? []).map((p) => [p.time, p.value]));
  const chartData = (rxEntry?.points ?? []).map((pt) => ({
    time: pt.time,
    rx:   pt.value,
    tx:   txByTime.get(pt.time) ?? 0,
  }));

  const tooltipStyle = {
    borderRadius: 10,
    border: `1px solid ${theme === "dark" ? "rgba(90,130,190,0.25)" : "rgba(10,20,50,0.15)"}`,
    background: theme === "dark" ? "#060e1c" : "#ffffff",
    color:      theme === "dark" ? "#e2eaf6"  : "#0d1b2e",
    fontSize: 12,
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Network{iface ? ` — ${iface}` : ""}</p>
          <h2 className="panel-title">Throughput</h2>
        </div>
        <div className="net-latest">
          <span className="net-badge rx">↓ {rxLatest === null ? "—" : formatBytesPerSec(rxLatest)}</span>
          <span className="net-badge tx">↑ {txLatest === null ? "—" : formatBytesPerSec(txLatest)}</span>
        </div>
      </div>

      {!iface ? (
        <p className="empty-hint">수집 중...</p>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={28}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
              <YAxis tickLine={false} axisLine={false} width={56}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                tickFormatter={formatBytesPerSec} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [
                  formatBytesPerSec(v),
                  name === "rx" ? "수신 (RX)" : "송신 (TX)",
                ]} />
              <Legend formatter={(v) => v === "rx" ? "수신 (RX)" : "송신 (TX)"} />
              <Line type="monotone" dataKey="rx" stroke="var(--color-green)"
                strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="tx" stroke="var(--color-blue)"
                strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
