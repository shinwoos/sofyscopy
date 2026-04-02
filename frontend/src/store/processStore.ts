import { create } from "zustand";
import type { ContainerSnapshot, ProcessSnapshot } from "../types/process";

type ProcessState = {
  processSnapshots: Record<string, ProcessSnapshot>;
  containerSnapshots: Record<string, ContainerSnapshot>;
  setProcessSnapshot: (snapshot: ProcessSnapshot) => void;
  setContainerSnapshot: (snapshot: ContainerSnapshot) => void;
};

export const useProcessStore = create<ProcessState>((set) => ({
  processSnapshots: {},
  containerSnapshots: {},
  setProcessSnapshot: (snapshot) =>
    set((state) => ({
      processSnapshots: {
        ...state.processSnapshots,
        [snapshot.server_id]: snapshot,
      },
    })),
  setContainerSnapshot: (snapshot) =>
    set((state) => ({
      containerSnapshots: {
        ...state.containerSnapshots,
        [snapshot.server_id]: snapshot,
      },
    })),
}));
