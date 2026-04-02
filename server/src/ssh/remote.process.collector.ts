import { exec } from "./connection.manager";
import { PROCESS_TOP_N } from "../config/env";
import type { ProcessSnapshot } from "../types/process";

const PROCESS_CMD = `ps -eo pid=,comm=,%cpu=,%mem=,rss=,args= --sort=-%cpu | head -n ${PROCESS_TOP_N}`;

export async function collectRemoteProcessSnapshot(serverId: string): Promise<ProcessSnapshot> {
  const raw = await exec(serverId, PROCESS_CMD);

  const processes = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(.+)$/);
      if (!match) {
        return null;
      }

      const [, pid, name = "", cpu, mem, rss, command = ""] = match;

      return {
        pid: Number(pid),
        name,
        cpu: Number(cpu),
        mem: Number(mem),
        memRss: Number(rss) * 1024,
        command: command.slice(0, 80),
      };
    })
    .filter((process): process is NonNullable<typeof process> => process !== null);

  return {
    server_id: serverId,
    ts: Date.now(),
    processes,
  };
}
