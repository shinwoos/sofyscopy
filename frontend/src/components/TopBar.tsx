import { useUiStore } from "../store/uiStore";

// ── 상단 바 ────────────────────────────────────────────────────────────────────
// 햄버거 버튼: 클릭 시 사이드바 토글 + 세 줄 ↔ X 애니메이션
// 테마 토글: 다크/라이트 모드 전환
// WS 상태 배지: 연결 상태 표시

type TopBarProps = {
  status: string; // WebSocket 연결 상태
  activeServerName: string;
  activeServerHost: string;
};

export function TopBar({ status, activeServerName, activeServerHost }: TopBarProps) {
  const { sidebarOpen, toggleSidebar, theme, setTheme } = useUiStore();

  const statusLabel =
    status === "connected"    ? "Connected"
    : status === "error"      ? "Error"
    : status === "disconnected" ? "Disconnected"
    : "Connecting";

  return (
    <header className="top-bar">
      {/* 햄버거 버튼: 세 줄 → X 애니메이션 */}
      <button
        className={`hamburger ${sidebarOpen ? "hamburger--open" : ""}`}
        onClick={toggleSidebar}
        aria-label="사이드바 토글"
      >
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
      </button>

      <div className="top-bar-title-wrap">
        <span className="top-bar-title">Operations Overview</span>
        <span className="top-bar-subtitle">{activeServerName} · {activeServerHost}</span>
      </div>

      <div className="top-bar-right">
        {/* WS 연결 상태 배지 */}
        <div className={`status-badge status-badge--${status}`}>
          <span className="status-dot" />
          {statusLabel}
        </div>

        {/* 다크/라이트 토글 */}
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="테마 변경"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </header>
  );
}
