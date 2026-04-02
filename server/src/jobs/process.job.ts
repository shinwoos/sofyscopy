import { PROCESS_COLLECT_INTERVAL_MS } from "../config/env";
import { collectProcessSnapshot } from "../collectors/process.collector";
import { publishProcessSnapshot } from "../services/process.service";

export function startProcessJob(serverId = "local") {
  setInterval(() => {
    void collectProcessSnapshot(serverId)
      .then(publishProcessSnapshot)
      .catch((error) => {
        console.error("process collector failed", error);
      });
  }, PROCESS_COLLECT_INTERVAL_MS);
}
