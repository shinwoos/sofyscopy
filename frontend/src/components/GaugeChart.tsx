// ── GaugeChart (SVG 계기판) ────────────────────────────────────────────────────
// 자동차 속도계처럼 270° 호(arc)를 그리는 원형 게이지
//
// 구현 방식: SVG circle의 stroke-dasharray 트릭
//   - circle의 stroke는 원래 3시 방향(오른쪽)에서 시작해 시계방향으로 그려짐
//   - stroke-dasharray로 "그릴 길이"를 제어 → 원의 일부만 색칠
//   - rotate(135)로 시작 지점을 7시 30분 방향으로 이동 → 갭이 아래에 위치
//   - 배경 호: 270° (0.75 * circumference), 전경 호: value% 만큼
//
// 색상 자동 변환:
//   0~59%: 초록 / 60~79%: 노랑 / 80~89%: 주황 / 90~100%: 빨강

type GaugeChartProps = {
  value: number;       // 0 ~ 100
  size?: number;       // SVG 한 변 크기 (px)
  strokeWidth?: number;
  centerLabel?: string; // 게이지 안쪽 중앙 서브 텍스트
};

function getArcColor(value: number): string {
  if (value >= 90) return "var(--color-red)";
  if (value >= 80) return "var(--color-orange)";
  if (value >= 60) return "var(--color-yellow)";
  return "var(--color-green)";
}

export function GaugeChart({ value, size = 140, strokeWidth, centerLabel }: GaugeChartProps) {
  const sw  = strokeWidth ?? Math.round(size * 0.09); // 기본 스트로크 너비: 지름의 9%
  const r   = (size - sw) / 2;
  const cx  = size / 2;
  const cy  = size / 2;
  const circ    = 2 * Math.PI * r;
  const arcLen  = circ * 0.75;                                  // 270° 구간
  // NaN/Infinity 방어: isNaN이면 0으로 폴백
  const safeVal = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const fillLen = arcLen * (safeVal / 100);
  const color   = getArcColor(value);

  // rotate(135 cx cy): 시작점을 7시 30분(왼쪽 하단) → 시계방향 270° → 4시 30분(오른쪽 하단)
  // 갭은 4시 30분 ~ 7시 30분(하단 90°) 구간
  const transform = `rotate(135 ${cx} ${cy})`;

  return (
    <div className="gauge-wrap">
      <div className="gauge-svg-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {/* 배경 호 — 270° 전체를 흐린 색으로 */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={sw}
            strokeDasharray={`${arcLen} ${circ - arcLen}`}
            strokeLinecap="round"
            transform={transform}
          />
          {/* 값 호 — value%만큼 채움, 부드러운 전환 애니메이션 */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeDasharray={`${fillLen} ${circ - fillLen}`}
            strokeLinecap="round"
            transform={transform}
            style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }}
          />
        </svg>

        {/* 중앙 텍스트 — SVG 위에 절대 위치로 겹침 */}
        <div className="gauge-center">
          <span className="gauge-value">{safeVal.toFixed(1)}<span className="gauge-unit">%</span></span>
          {centerLabel && <span className="gauge-center-label">{centerLabel}</span>}
        </div>
      </div>
    </div>
  );
}
