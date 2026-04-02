import { CONTAINER_COLLECT_INTERVAL_MS } from "../config/env";
import { collectContainerSnapshot } from "../collectors/container.collector";
import { publishContainerSnapshot } from "../services/process.service";

export function startContainerJob(serverId = "local") {
  setInterval(() => {
    void collectContainerSnapshot(serverId)
      .then(publishContainerSnapshot)
      .catch((error) => {
        console.error("container collector failed", error);
      });
  }, CONTAINER_COLLECT_INTERVAL_MS);
}
