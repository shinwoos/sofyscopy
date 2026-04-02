import si from "systeminformation";
import { PROCESS_TOP_N } from "../config/env";
import type { ProcessSnapshot } from "../types/process";

export async function collectProcessSnapshot(serverId = "local"): Promise<ProcessSnapshot> {
  const data = await si.processes();

  const processes = data.list
    .slice()
    .sort((a, b) => (b.cpu ?? 0) - (a.cpu ?? 0))
    .slice(0, PROCESS_TOP_N)
    .map((process) => ({
      pid: process.pid,
      name: process.name,
      cpu: Math.round((process.cpu ?? 0) * 10) / 10,
      mem: Math.round((process.mem ?? 0) * 10) / 10,
      memRss: process.memRss ?? 0,
      command: (process.command ?? "").slice(0, 80),
    }));

  return {
    server_id: serverId,
    ts: Date.now(),
    processes,
  };
}
