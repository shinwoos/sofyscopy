import { startCpuJob }     from "./cpu.job";
import { startMemoryJob }  from "./memory.job";
import { startDiskJob }    from "./disk.job";
import { startNetworkJob } from "./network.job";
import { startPruneJob }   from "./prune.job";
import { startProcessJob } from "./process.job";
import { startContainerJob } from "./container.job";
import { startRemoteJob }  from "./remote.job";
import { connect }         from "../ssh/connection.manager";
import { selectAllServers } from "../db/servers.repository";
import { updateServerStatus } from "../db/servers.repository";

// ── Job 진입점 ─────────────────────────────────────────────────────────────────
// 모든 백그라운드 job을 한 곳에서 시작
// 새 job 추가 시 이 파일에만 import와 호출을 추가하면 됨

export function startAllJobs() {
  // ── 로컬 수집 Job ────────────────────────────────────────────────────────────
  startCpuJob();
  startMemoryJob();
  startDiskJob();
  startNetworkJob();
  startProcessJob();
  startContainerJob();
  startPruneJob();

  // ── 원격 서버 복원 ────────────────────────────────────────────────────────────
  // 앱 재시작 시 DB에 등록된 원격 서버에 자동으로 재연결
  // 실패한 서버는 connection.manager의 지수 백오프 재연결이 담당
  const servers = selectAllServers().filter((s) => s.auth_type !== "local");

  for (const server of servers) {
    // 오프라인으로 초기화 → 연결 성공 시 online으로 전환됨
    updateServerStatus(server.id, "offline");

    connect(server)
      .then(() => {
        startRemoteJob(server);
      })
      .catch((err: Error) => {
        console.warn(`[remote] ${server.name} (${server.host}) 재연결 실패: ${err.message}`);
        // connection.manager가 재연결을 계속 시도함
      });
  }
}
