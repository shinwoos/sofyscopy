import type { MetricPayload } from "../types/metric";
import type { ContainerSnapshot, ProcessSnapshot } from "../types/process";
import type { ServerStatus } from "../types/server";

// WebSocket 클라이언트 인터페이스 — Elysia ws 객체가 이 형태를 만족함
type WsClient = {
  send(data: string): unknown;
};

// 현재 연결된 클라이언트 목록
// Set을 사용해 중복 등록 방지 + O(1) 삽입/삭제
const clients = new Set<WsClient>();

// 클라이언트가 /ws에 연결했을 때 등록 (ws.route.ts의 open 핸들러에서 호출)
export function addWsClient(client: WsClient) {
  clients.add(client);
}

// 클라이언트가 연결을 끊었을 때 제거 (ws.route.ts의 close 핸들러에서 호출)
export function removeWsClient(client: WsClient) {
  clients.delete(client);
}

// 모든 연결 클라이언트에게 메시지를 전송하는 내부 헬퍼
function broadcast(message: string) {
  for (const client of clients) {
    try {
      client.send(message);
    } catch {
      // 이미 끊어진 클라이언트 — 다음 close 이벤트에서 Set에서 제거됨
      // 한 클라이언트 실패가 나머지 브로드캐스트를 막지 않도록 계속 진행
    }
  }
}

// 메트릭 브로드캐스트 — metrics.service.ts의 persistCollectedMetric에서 호출
// server_id 포함: 프론트엔드가 어느 서버의 메트릭인지 구분 가능
export function broadcastMetric(metric: MetricPayload) {
  broadcast(JSON.stringify({ type: "metric", metric }));
}

export function broadcastProcessSnapshot(snapshot: ProcessSnapshot) {
  broadcast(JSON.stringify({ type: "process_update", snapshot }));
}

export function broadcastContainerSnapshot(snapshot: ContainerSnapshot) {
  broadcast(JSON.stringify({ type: "container_update", snapshot }));
}

// 서버 연결 상태 변경 브로드캐스트 — SSH 연결 성공/실패 시 호출
// 프론트엔드 사이드바의 상태 점(dot)을 실시간으로 업데이트
export function broadcastServerStatus(serverId: string, status: ServerStatus) {
  broadcast(JSON.stringify({ type: "server_status", server_id: serverId, status }));
}

// 현재 연결된 클라이언트 수 반환 — 헬스체크나 디버그 로그에서 활용 가능
export function getConnectedClientCount() {
  return clients.size;
}
