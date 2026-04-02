import { db } from "./client";
import type { MetricName, MetricPayload, MetricRow } from "../types/metric";

// ── Prepared Statements ────────────────────────────────────────────────────────
// 서버 시작 시 한 번만 컴파일 → 이후 실행마다 파싱 비용 없음
// 플레이스홀더(?)로 값을 바인딩하므로 SQL injection 방지

// 메트릭 1건 저장
const insertMetricStatement = db.prepare(
  "INSERT INTO metrics (server_id, name, value, ts) VALUES (?, ?, ?, ?)",
);

// 최근 20건 조회 — ts DESC로 최신순 정렬, 개발 중 적재 확인용
const selectRecentMetricsStatement = db.prepare(`
  SELECT id, server_id, name, value, ts
  FROM metrics
  ORDER BY ts DESC
  LIMIT 20
`);

// 특정 메트릭 이름의 최신값 1건 — 인덱스 (name, ts DESC) 사용
const selectLatestMetricStatement = db.prepare(`
  SELECT id, name, value, ts
  FROM metrics
  WHERE name = ?
  ORDER BY ts DESC
  LIMIT 1
`);

// 만료 데이터 삭제 — olderThanTs보다 오래된 행 제거 (prune.job에서 호출)
const pruneMetricsStatement = db.prepare("DELETE FROM metrics WHERE ts < ?");

// ── Repository 함수 ────────────────────────────────────────────────────────────

// 메트릭 1건을 DB에 저장하고 SQLite 결과(lastInsertRowid 등)를 반환
export function insertMetric(metric: MetricPayload) {
  return insertMetricStatement.run(metric.server_id, metric.name, metric.value, metric.ts);
}

// 최근 20건 조회 — API /api/metrics/recent 에서 사용
export function selectRecentMetrics() {
  return selectRecentMetricsStatement.all() as MetricRow[];
}

// 특정 이름의 최신 메트릭 1건 조회 — 없으면 null 반환
export function selectLatestMetric(name: MetricName) {
  return selectLatestMetricStatement.get(name) as MetricRow | null;
}

// olderThanTs 이전 데이터를 전부 삭제 — 보관 기간 7일 적용
export function pruneMetrics(olderThanTs: number) {
  return pruneMetricsStatement.run(olderThanTs);
}
