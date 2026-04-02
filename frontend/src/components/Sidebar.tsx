import { useState } from "react";
import { useUiStore }    from "../store/uiStore";
import { useServerStore } from "../store/serverStore";
import { AddServerModal } from "./AddServerModal";
import type { Server }   from "../store/serverStore";

// ── 사이드바 ───────────────────────────────────────────────────────────────────
// 등록된 서버 목록을 표시하고 활성 서버를 전환
// sidebarOpen 상태에 따라 CSS transition으로 슬라이드 in/out

// 상태 점 색상
const STATUS_COLOR: Record<string, string> = {
  online:  "var(--color-green)",
  offline: "var(--color-red)",
  error:   "var(--color-yellow)",
  unknown: "var(--color-text-muted)",
};

export function Sidebar() {
  const sidebarOpen    = useUiStore((s) => s.sidebarOpen);
  const servers        = useServerStore((s) => s.servers);
  const activeId       = useServerStore((s) => s.activeServerId);
  const setActive      = useServerStore((s) => s.setActiveServer);
  const addServer      = useServerStore((s) => s.addServer);
  const removeServer   = useServerStore((s) => s.removeServer);

  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function handleAdded(server: Server) {
    addServer(server);
    setActive(server.id);
  }

  async function handleDelete(id: string) {
    if (deleteConfirm !== id) {
      // 첫 클릭: 확인 모드로 전환 (3초 후 자동 취소)
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    // 두 번째 클릭: 실제 삭제
    setDeleteConfirm(null);
    try {
      await fetch(`/api/servers/${id}`, { method: "DELETE" });
      removeServer(id);
    } catch {
      console.error("서버 삭제 실패");
    }
  }

  return (
    <>
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar-inner">
          {/* 로고 */}
          <div className="sidebar-logo">
            <span className="sidebar-logo-text">devScope</span>
          </div>

          {/* 섹션 레이블 */}
          <p className="sidebar-section-label">Servers</p>

          {/* 서버 목록 */}
          <ul className="server-list">
            {servers.map((server) => (
              <li
                key={server.id}
                className={`server-item ${activeId === server.id ? "server-item--active" : ""}`}
                onClick={() => setActive(server.id)}
              >
                {/* 상태 점 */}
                <span
                  className="server-status-dot"
                  style={{ background: STATUS_COLOR[server.status] ?? STATUS_COLOR.unknown }}
                />
                <div className="server-info">
                  <span className="server-name">{server.name}</span>
                  <span className="server-host">
                    {server.id === "local" ? "localhost" : `${server.host}:${server.port}`}
                  </span>
                </div>

                {/* 원격 서버만 삭제 버튼 표시 */}
                {server.id !== "local" && (
                  <button
                    className={`server-delete-btn ${deleteConfirm === server.id ? "server-delete-btn--confirm" : ""}`}
                    title={deleteConfirm === server.id ? "클릭해서 삭제 확인" : "서버 삭제"}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(server.id);
                    }}
                  >
                    {deleteConfirm === server.id ? "확인" : "×"}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* 서버 추가 버튼 */}
          <button className="add-server-btn" onClick={() => setShowModal(true)}>
            <span className="add-server-icon">+</span>
            서버 추가
          </button>
        </div>
      </aside>

      {/* 서버 추가 모달 */}
      {showModal && (
        <AddServerModal
          onClose={() => setShowModal(false)}
          onAdded={handleAdded}
        />
      )}
    </>
  );
}
