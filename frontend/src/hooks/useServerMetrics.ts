import { useServerStore } from "../store/serverStore";
import { useMetricsStore } from "../store/metricsStore";
import type { MetricEntry } from "../store/metricsStore";

const EMPTY_ENTRIES: Record<string, MetricEntry> = {};

// ── 서버 메트릭 셀렉터 훅 ──────────────────────────────────────────────────────
// 패널 컴포넌트가 activeServerId를 직접 알 필요 없이
// 현재 활성 서버의 메트릭을 투명하게 조회할 수 있게 해주는 헬퍼
//
// 사용 예:
//   const entries = useServerMetrics();
//   const pct = entries["cpu.usage_percent"]?.latest ?? null;
//
// 이점:
//   - 서버 전환 시 모든 패널이 자동으로 새 서버 메트릭을 표시
//   - 패널 코드가 server_id를 몰라도 됨

// 활성 서버의 전체 메트릭 엔트리 반환
// DiskPanel / NetworkPanel처럼 키 목록이 동적인 패널에서 사용
export function useServerMetrics(): Record<string, MetricEntry> {
  const activeId = useServerStore((s) => s.activeServerId);
  return useMetricsStore((s) => s.entries[activeId] ?? EMPTY_ENTRIES);
}

// 활성 서버의 특정 메트릭 엔트리 반환
// CpuPanel / MemoryPanel처럼 고정된 단일 메트릭을 구독하는 패널에서 사용
// 해당 메트릭이 아직 없으면 null 반환
export function useMetricEntry(name: string): MetricEntry | null {
  const activeId = useServerStore((s) => s.activeServerId);
  return useMetricsStore((s) => s.entries[activeId]?.[name] ?? null);
}
