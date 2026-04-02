import { useState } from "react";
import { useServerMetrics } from "../hooks/useServerMetrics";
import { GaugeChart }       from "./GaugeChart";

// ── 디스크 패널 ────────────────────────────────────────────────────────────────
// 마운트가 1~2개면 게이지, 3개 이상이면 가로 막대 그래프로 자동 전환
// useServerMetrics 훅으로 활성 서버의 메트릭을 조회

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} B`;
}

function getBarColor(value: number): string {
  if (value >= 90) return "var(--color-red)";
  if (value >= 80) return "var(--color-orange)";
  if (value >= 60) return "var(--color-yellow)";
  return "var(--color-green)";
}

export function DiskPanel() {
  const entries = useServerMetrics();
  const [viewMode, setViewMode] = useState<"gauge" | "bar" | null>(null);

  const mounts = Object.keys(entries)
    .filter((k) => k.startsWith("disk.") && k.endsWith(".used_percent"))
    .map((k) => k.split(".").slice(1, -1).join("."));

  const autoUseGauge = mounts.length <= 2; // 1~2개: 게이지 / 3개+: 막대 그래프
  const useGauge = viewMode === null ? autoUseGauge : viewMode === "gauge";

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Disk</p>
          <h2 className="panel-title">Storage</h2>
        </div>

        <div className="panel-view-toggle" role="group" aria-label="디스크 보기 방식">
          <button
            type="button"
            className={`panel-view-toggle__btn ${viewMode === "gauge" ? "panel-view-toggle__btn--active" : ""}`}
            onClick={() => setViewMode("gauge")}
          >
            원형
          </button>
          <button
            type="button"
            className={`panel-view-toggle__btn ${viewMode === "bar" ? "panel-view-toggle__btn--active" : ""}`}
            onClick={() => setViewMode("bar")}
          >
            바형
          </button>
        </div>
      </div>

      {mounts.length === 0 ? (
        <p className="empty-hint">수집 중...</p>
      ) : useGauge ? (
        /* ── 게이지 레이아웃 (1~2개 마운트) ─────────────────────────────── */
        <div className="disk-gauges">
          {mounts.map((mount) => {
            const pct   = entries[`disk.${mount}.used_percent`]?.latest ?? 0;
            const bytes = entries[`disk.${mount}.used_bytes`]?.latest ?? null;
            const label = mount === "root" ? "/" : mount.toUpperCase();
            return (
              <div key={mount} className="disk-gauge-item">
                <GaugeChart value={pct} size={130} centerLabel={label} />
                <span className="disk-gauge-bytes">
                  {bytes === null ? "" : formatBytes(bytes)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── 막대 그래프 레이아웃 (3개+ 마운트) ─────────────────────────── */
        <div className="disk-bars">
          {mounts.map((mount) => {
            const pct   = entries[`disk.${mount}.used_percent`]?.latest ?? 0;
            const bytes = entries[`disk.${mount}.used_bytes`]?.latest ?? null;
            const label = mount === "root" ? "/" : mount.toUpperCase();
            return (
              <div key={mount} className="disk-bar-row">
                <div className="disk-bar-meta">
                  <span className="disk-label">{label}</span>
                  <span className="disk-pct">{pct.toFixed(1)}%</span>
                  <span className="disk-bytes">{bytes === null ? "" : formatBytes(bytes)}</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${pct}%`, background: getBarColor(pct) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
