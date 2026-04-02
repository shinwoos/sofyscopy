import {
  CPU_COLLECT_INTERVAL_MS,
  MEMORY_COLLECT_INTERVAL_MS,
  DISK_COLLECT_INTERVAL_MS,
  NETWORK_COLLECT_INTERVAL_MS,
} from "../config/env";
import { collectRemoteMetrics } from "../ssh/remote.collector";
import { collectRemoteProcessSnapshot } from "../ssh/remote.process.collector";
import { collectRemoteContainerSnapshot } from "../ssh/remote.container.collector";
import { persistCollectedMetrics } from "../services/metrics.service";
import {
  publishContainerSnapshot,
  publishProcessSnapshot,
} from "../services/process.service";
import type { ServerRow } from "../types/server";

// ── 원격 서버 수집 Job ─────────────────────────────────────────────────────────
// 원격 서버당 독립적인 setInterval 집합을 관리
// 서버 추가 → startRemoteJob(), 서버 삭제 → stopRemoteJob()
//
// 구현 방식:
//   - 로컬 서버처럼 메트릭 종류별로 별도 interval을 두지 않고
//     단일 SSH exec으로 CPU/메모리/디스크/네트워크를 한 번에 수집
//   - CPU·네트워크는 짧은 주기(2초), 메모리·디스크는 해당 주기를 modulo로 건너뜀
//   - 불필요한 SSH 채널을 줄이고 원격 서버 부하를 최소화

// server_id → interval handle 배열
const remoteJobs = new Map<string, ReturnType<typeof setInterval>[]>();

// 수집 주기 — CPU·네트워크 기준으로 가장 짧은 값 사용
const BASE_INTERVAL_MS = Math.min(CPU_COLLECT_INTERVAL_MS, NETWORK_COLLECT_INTERVAL_MS);

export function startRemoteJob(server: ServerRow) {
  if (remoteJobs.has(server.id)) return; // 이미 실행 중이면 중복 시작 방지

  let tick = 0;

  const handle = setInterval(async () => {
    tick++;

    try {
      const [results, processSnapshot, containerSnapshot] = await Promise.all([
        collectRemoteMetrics(server.id),
        collectRemoteProcessSnapshot(server.id),
        collectRemoteContainerSnapshot(server.id),
      ]);
      persistCollectedMetrics(results, server.id);
      publishProcessSnapshot(processSnapshot);
      publishContainerSnapshot(containerSnapshot);
    } catch {
      // SSH 연결 오류는 connection.manager가 재연결을 처리하므로 여기서는 무시
      // console.error는 의도적으로 생략 — 재연결 중 대량 로그 방지
    }
  }, BASE_INTERVAL_MS);

  remoteJobs.set(server.id, [handle]);
}

export function stopRemoteJob(serverId: string) {
  const handles = remoteJobs.get(serverId);
  if (handles) {
    for (const h of handles) clearInterval(h);
    remoteJobs.delete(serverId);
  }
}
