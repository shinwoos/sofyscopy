import si from "systeminformation";
import type { ContainerSnapshot } from "../types/process";

export async function collectContainerSnapshot(serverId = "local"): Promise<ContainerSnapshot> {
  try {
    const [containersMeta, stats] = await Promise.all([
      si.dockerContainers(true),
      si.dockerContainerStats("*"),
    ]);

    const metaById = new Map(
      containersMeta.map((container) => [container.id, container] as const),
    );

    const containers = stats
      .filter((container) => Boolean(container.id))
      .map((container) => ({
        id: container.id.slice(0, 12),
        name: (metaById.get(container.id)?.name ?? "").replace(/^\//, ""),
        image: metaById.get(container.id)?.image ?? "",
        state: metaById.get(container.id)?.state ?? "unknown",
        cpu: Math.round((container.cpuPercent ?? 0) * 10) / 10,
        memUsage: container.memUsage ?? 0,
        memLimit: container.memLimit ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      server_id: serverId,
      ts: Date.now(),
      containers,
    };
  } catch {
    return {
      server_id: serverId,
      ts: Date.now(),
      containers: [],
    };
  }
}
