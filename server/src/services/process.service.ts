import {
  broadcastContainerSnapshot,
  broadcastProcessSnapshot,
} from "./ws.service";
import type { ContainerSnapshot, ProcessSnapshot } from "../types/process";

const lastProcessSnapshot = new Map<string, ProcessSnapshot>();
const lastContainerSnapshot = new Map<string, ContainerSnapshot>();

export function publishProcessSnapshot(snapshot: ProcessSnapshot) {
  lastProcessSnapshot.set(snapshot.server_id, snapshot);
  broadcastProcessSnapshot(snapshot);
}

export function publishContainerSnapshot(snapshot: ContainerSnapshot) {
  lastContainerSnapshot.set(snapshot.server_id, snapshot);
  broadcastContainerSnapshot(snapshot);
}

export function getLastProcessSnapshot(serverId: string) {
  return lastProcessSnapshot.get(serverId);
}

export function getLastContainerSnapshot(serverId: string) {
  return lastContainerSnapshot.get(serverId);
}
