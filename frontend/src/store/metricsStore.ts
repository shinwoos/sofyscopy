import { create } from "zustand";

// ── 메트릭 스토어 (Zustand) ────────────────────────────────────────────────────
// 서버별·메트릭별 링 버퍼를 2단계 중첩 Map으로 관리
//   entries[server_id][metric_name] → MetricEntry
//
// 패널 컴포넌트는 activeServerId를 사용해 해당 서버의 메트릭만 구독
// selector 덕분에 다른 서버 메트릭 업데이트 시 리렌더 없음
//
// 링 버퍼:
//   300포인트 × 2초 = 10분치 — 라인 차트에 충분한 시각 범위
//   MAX_POINTS 초과 시 앞에서부터 제거 (메모리 누수 방지)

const MAX_POINTS = 300;

// 차트에 넘기는 단일 포인트
export type ChartPoint = {
  time:  string;  // formatTime()으로 변환된 HH:MM:SS
  value: number;
};

// 메트릭 하나의 상태: 차트용 시계열 + 최신값(stat 카드용)
export type MetricEntry = {
  points: ChartPoint[];
  latest: number | null;
};

type MetricsState = {
  // 1단계 키: server_id ("local", "prod-01" 등)
  // 2단계 키: 메트릭 이름 ("cpu.usage_percent", "net.eth0.rx_bytes_sec" 등)
  entries: Record<string, Record<string, MetricEntry>>;

  // WS 메시지 수신 시 호출 — 해당 서버+메트릭의 링 버퍼에 포인트 추가
  pushPoint: (serverId: string, name: string, value: number, ts: number) => void;
};

// Unix epoch ms → "HH:MM:SS"
function formatTime(ts: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(ts);
}

export const useMetricsStore = create<MetricsState>((set) => ({
  entries: {},

  pushPoint: (serverId, name, value, ts) => {
    set((state) => {
      const serverEntries = state.entries[serverId] ?? {};
      const prev  = serverEntries[name] ?? { points: [], latest: null };
      const point: ChartPoint = { time: formatTime(ts), value };

      return {
        entries: {
          ...state.entries,
          [serverId]: {
            ...serverEntries,
            [name]: {
              points: [...prev.points.slice(-(MAX_POINTS - 1)), point],
              latest: value,
            },
          },
        },
      };
    });
  },
}));
