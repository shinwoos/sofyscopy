import { Elysia } from "elysia";
import { addWsClient, removeWsClient } from "../services/ws.service";
import { cleanupLogFollow, handleLogFollowMessage } from "../services/log-follow.service";
import type { LogFollowClientMessage } from "../types/log";

// ── WebSocket 라우트 ───────────────────────────────────────────────────────────
// WS /ws
// 클라이언트가 연결하면 ws.service의 clients Set에 등록
// 이후 metrics.service가 새 메트릭을 수집할 때마다 broadcast를 통해 자동으로 데이터를 받음
//
// 현재는 서버 → 클라이언트 단방향 푸시만 구현
// 추후 클라이언트 → 서버 구독 메시지 처리가 필요하면 message 핸들러 추가

export const wsRoute = new Elysia().ws("/ws", {
  // 연결 수립 시: 클라이언트를 브로드캐스트 대상 목록에 추가
  open(ws) {
    addWsClient(ws);
    // 연결 직후 확인 메시지 전송 — 클라이언트가 연결 성공을 감지하는 데 사용
    ws.send(
      JSON.stringify({
        type: "connected",
        message: "websocket connected",
      }),
    );
  },

  async message(ws, message) {
    try {
      const payload = typeof message === "string"
        ? JSON.parse(message) as LogFollowClientMessage
        : message as LogFollowClientMessage;

      if (payload.type === "log_follow_start" || payload.type === "log_follow_stop") {
        await handleLogFollowMessage(ws, payload);
      }
    } catch {
      // 로그 follow 외 메시지는 현재 무시
    }
  },

  // 연결 종료 시: 클라이언트를 목록에서 제거
  // 이후 broadcast 시 이 클라이언트에게는 전송하지 않음
  close(ws) {
    cleanupLogFollow(ws);
    removeWsClient(ws);
  },
});
