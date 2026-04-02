// ── 메트릭 타입 ────────────────────────────────────────────────────────────────
// DB와 API에서 공통으로 사용하는 메트릭 관련 타입 정의

// 지원하는 메트릭 이름 — 콜렉터 추가 시 이 타입을 함께 확장
// 템플릿 리터럴 타입: 디스크·네트워크는 마운트/인터페이스 이름이 런타임에 결정되므로
// `disk.${string}.used_percent` 형태로 선언해 컴파일 타임 검사와 유연성을 동시에 확보
export type MetricName =
  | "cpu.usage_percent"
  | "mem.used_percent"
  | "mem.used_bytes"
  | "mem.available_bytes"
  | "mem.swap_used_bytes"
  | `disk.${string}.used_percent`
  | `disk.${string}.used_bytes`
  | `net.${string}.rx_bytes_sec`
  | `net.${string}.tx_bytes_sec`;

// DB metrics 테이블의 행 구조
export type MetricRow = {
  id: number;
  server_id: string;
  name: MetricName;
  value: number;
  ts: number; // Unix epoch ms
};

// WS 브로드캐스트와 DB 저장에 사용하는 페이로드
// server_id: 메트릭을 수집한 서버 (로컬은 "local", 원격은 서버 slug)
export type MetricPayload = {
  server_id: string;
  name: MetricName;
  value: number;
  ts: number;
};
