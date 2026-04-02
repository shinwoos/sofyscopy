import { create } from "zustand";

// ── 서버 스토어 (Zustand) ──────────────────────────────────────────────────────
// 등록된 서버 목록과 현재 활성 서버를 전역으로 관리
// WS 메시지(server_status)로 상태가 실시간 갱신됨

export type ServerStatus = "online" | "offline" | "error" | "unknown";

export type Server = {
  id:       string;
  name:     string;
  host:     string;
  port:     number;
  username: string;
  status:   ServerStatus;
};

type ServerState = {
  servers:        Server[];
  activeServerId: string;

  setServers:          (servers: Server[]) => void;
  addServer:           (server: Server)    => void;
  removeServer:        (id: string)        => void;
  updateServerStatus:  (id: string, status: ServerStatus) => void;
  setActiveServer:     (id: string)        => void;
};

export const useServerStore = create<ServerState>((set) => ({
  servers:        [],
  activeServerId: "local", // 앱 시작 시 항상 로컬 서버가 기본

  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((s) => ({ servers: [...s.servers, server] })),

  removeServer: (id) =>
    set((s) => ({
      servers:        s.servers.filter((sv) => sv.id !== id),
      // 삭제된 서버가 활성 서버면 로컬로 전환
      activeServerId: s.activeServerId === id ? "local" : s.activeServerId,
    })),

  updateServerStatus: (id, status) =>
    set((s) => ({
      servers: s.servers.map((sv) =>
        sv.id === id ? { ...sv, status } : sv,
      ),
    })),

  setActiveServer: (id) => set({ activeServerId: id }),
}));
