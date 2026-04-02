import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 개발 시 Vite(:5173)에서 서버(:3001)로 API/WS 요청을 프록시
      // 이렇게 하면 WS_URL을 window.location.host 기반으로 써도 정상 동작
      "/api": "http://localhost:3001",
      "/health": "http://localhost:3001",
      // /ws는 프록시 미사용 — Bun/Elysia 네이티브 WS와 Vite 프록시 간 호환 문제
      // App.tsx에서 개발 모드일 때 ws://localhost:3001/ws에 직접 연결
    },
  },
});
