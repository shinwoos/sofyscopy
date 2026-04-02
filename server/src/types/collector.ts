import type { MetricName } from "./metric";

// ── 콜렉터 타입 ────────────────────────────────────────────────────────────────
// 콜렉터 함수의 반환 타입 정의
//
// CollectorResult는 MetricPayload와 의도적으로 분리:
//   - 콜렉터는 server_id를 모름 (어느 서버에 속하는지는 service 계층이 결정)
//   - persistCollectedMetric(result, serverId) 호출 시 server_id를 주입

export type CollectorResult =
  | {
      ok:        true;
      collected: false;
      reason:    string;
    }
  | {
      ok:          true;
      collected:   true;
      name:        MetricName;
      value:       number;
      ts:          number;
      insertedId?: number | bigint; // persistCollectedMetric 이후 채워짐
    };
