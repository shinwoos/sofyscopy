import { insertMetric, pruneMetrics, selectLatestMetric, selectRecentMetrics } from "../db/metrics.repository";
import { METRIC_RETENTION_MS } from "../config/env";
import { broadcastMetric } from "./ws.service";
import type { CollectorResult } from "../types/collector";
import type { MetricName } from "../types/metric";

// ── 메트릭 서비스 ──────────────────────────────────────────────────────────────
// 비즈니스 로직 계층 — 라우트(route)와 데이터(repository) 사이를 연결
// DB 조회/저장, WS 브로드캐스트를 조합하는 역할

// 최근 20건 조회 — metrics.route.ts에서 호출
export function getRecentMetrics() {
  return selectRecentMetrics();
}

// 특정 메트릭 최신값 1건 조회 — metrics.route.ts에서 호출
export function getLatestMetric(name: MetricName) {
  return selectLatestMetric(name);
}

// 수집된 메트릭을 DB에 저장하고 연결된 모든 WS 클라이언트에게 브로드캐스트
// serverId: 로컬 서버는 "local" (기본값), 원격 서버는 해당 서버의 ID
// collected: false인 경우(베이스라인, 무효 델타)는 저장 없이 그대로 반환
export function persistCollectedMetric(result: CollectorResult, serverId = "local") {
  if (!result.collected) {
    return result;
  }

  // DB 저장 — server_id를 포함해 어느 서버의 메트릭인지 구분
  const insertResult = insertMetric({
    server_id: serverId,
    name:  result.name,
    value: result.value,
    ts:    result.ts,
  });

  const persistedResult = {
    ...result,
    insertedId: insertResult.lastInsertRowid,
  };

  // 저장 성공 후 WS 브로드캐스트 — 프론트엔드 차트가 실시간으로 업데이트됨
  broadcastMetric({
    server_id: serverId,
    name:  persistedResult.name,
    value: persistedResult.value,
    ts:    persistedResult.ts,
  });

  return persistedResult;
}

// 여러 메트릭을 한 번에 저장 + 브로드캐스트
// 메모리·디스크·네트워크·원격 콜렉터는 여러 메트릭을 배열로 반환하므로
// 배열을 받아 순회하는 헬퍼가 필요 — 내부적으로는 persistCollectedMetric 재사용
export function persistCollectedMetrics(results: CollectorResult[], serverId = "local") {
  for (const result of results) {
    persistCollectedMetric(result, serverId);
  }
}

// 보관 기간이 지난 메트릭 삭제 — prune.job.ts에서 1시간 주기로 호출
// now를 파라미터로 받아 테스트 시 임의의 시각을 주입할 수 있음
export function pruneExpiredMetrics(now = Date.now()) {
  return pruneMetrics(now - METRIC_RETENTION_MS);
}
