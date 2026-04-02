import {
  CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useMetricEntry } from "../hooks/useServerMetrics";
import { useUiStore }     from "../store/uiStore";

// ── CPU 패널 ───────────────────────────────────────────────────────────────────
// 활성 서버의 "cpu.usage_percent" 메트릭을 구독해 실시간 라인 차트로 표시
// useMetricEntry 훅이 server_id 전환을 투명하게 처리

export function CpuPanel() {
  const entry  = useMetricEntry("cpu.usage_percent");
  const theme  = useUiStore((s) => s.theme);
  const points = entry?.points ?? [];
  const latest = entry?.latest ?? null;

  // Recharts는 인라인 스타일을 쓰므로 CSS 변수 대신 JS 값으로 테마 적용
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
          <p className="eyebrow">CPU</p>
          <h2 className="panel-title">Usage</h2>
        </div>
        <strong className="stat-big">
          {latest === null ? "—" : `${latest.toFixed(1)}%`}
        </strong>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={28}
              tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36}
              tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
              tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={tooltipStyle}
              formatter={(v: number) => [`${v.toFixed(2)}%`, "CPU"]} />
            {/* isAnimationActive=false: 실시간 포인트 추가마다 애니메이션이 재실행되어 노이즈 */}
            <Line type="monotone" dataKey="value" stroke="var(--color-green)"
              strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
