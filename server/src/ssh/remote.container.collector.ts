import { exec } from "./connection.manager";
import type { ContainerSnapshot } from "../types/process";

const DOCKER_LIST_CMD =
  "docker ps -a --format '{{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.State}}' 2>/dev/null || true";
const DOCKER_STATS_CMD =
  "docker stats --no-stream --format '{{.ID}}\\t{{.CPUPerc}}\\t{{.MemUsage}}' 2>/dev/null || true";

function parseBytes(value: string) {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^([\d.]+)\s*([KMGTP]?I?B)$/);

  if (!match || !match[1] || !match[2]) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    MB: 1024 ** 2,
    MIB: 1024 ** 2,
    GB: 1024 ** 3,
    GIB: 1024 ** 3,
    TB: 1024 ** 4,
    TIB: 1024 ** 4,
    PB: 1024 ** 5,
    PIB: 1024 ** 5,
  };

  return Math.round(amount * (multipliers[unit] ?? 1));
}

export async function collectRemoteContainerSnapshot(serverId: string): Promise<ContainerSnapshot> {
  const [listRaw, statsRaw] = await Promise.all([
    exec(serverId, DOCKER_LIST_CMD),
    exec(serverId, DOCKER_STATS_CMD),
  ]);

  const statsById = new Map(
    statsRaw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [id = "", cpu = "0%", memUsage = "0B / 0B"] = line.split("\t");
        const [usage = "0B", limit = "0B"] = memUsage.split("/");
        return [
          id,
          {
            cpu: Number(cpu.replace("%", "").trim()) || 0,
            memUsage: parseBytes(usage),
            memLimit: parseBytes(limit),
          },
        ] as const;
      }),
  );

  const containers = listRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id = "", name = "", image = "", state = "unknown"] = line.split("\t");
      const stats = statsById.get(id);
      return {
        id: id.slice(0, 12),
        name,
        image,
        state,
        cpu: Math.round((stats?.cpu ?? 0) * 10) / 10,
        memUsage: stats?.memUsage ?? 0,
        memLimit: stats?.memLimit ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    server_id: serverId,
    ts: Date.now(),
    containers,
  };
}
