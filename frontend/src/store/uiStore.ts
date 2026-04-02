import { create } from "zustand";

// ── UI 스토어 ──────────────────────────────────────────────────────────────────
// 사이드바 열림/닫힘, 다크/라이트 테마 상태를 전역으로 관리
// localStorage에 테마를 저장해 새로고침 후에도 유지

export type Theme = "dark" | "light";

type UiState = {
  sidebarOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
};

export const useUiStore = create<UiState>((set) => ({
  // 첫 방문은 dark 기본, 이후 localStorage 값 사용
  // 저장된 값이 유효한 테마가 아닐 경우 dark로 폴백
  sidebarOpen: true,
  theme: ((): Theme => {
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "dark" ? stored : "dark";
  })(),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setTheme: (theme) => {
    // DOM 속성 변경 → CSS 변수 전환 즉시 적용
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    set({ theme });
  },
}));
