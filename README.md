# devScope

서버 메트릭을 실시간으로 수집하고 대시보드로 시각화하는 모니터링 프로그램.

---

## 기술 스택

### 런타임 — Bun

- Node.js 대신 Bun을 사용
- SQLite가 런타임에 내장되어 있어 별도 ORM/드라이버 불필요
- TypeScript를 컴파일 없이 바로 실행
- `bun build --compile`로 단일 바이너리 배포 가능
- 기존에 설치된 gstack 자체도 Bun 기반이라 환경 일치

### 백엔드 프레임워크 — Elysia.js

- Bun 전용으로 설계된 웹 프레임워크
- Express/Fastify 대비 Bun 위에서 약 10배 빠름
- REST 라우팅 + WebSocket을 하나의 프레임워크에서 처리
- TypeScript 타입이 라우트 파라미터까지 자동 추론됨

### 데이터베이스 — SQLite (bun:sqlite)

- 시계열 메트릭 저장 (수집 주기 2~5초)
- 외부 DB 서버 불필요, 파일 하나로 관리
- WAL 모드로 읽기/쓰기 동시 처리
- 7일치 원본 보관 + 1시간 롤업 테이블로 장기 조회 성능 확보

### 프론트엔드 — React 18 + Vite 5

- 대시보드 생태계(차트 라이브러리 등)가 React 중심으로 가장 성숙
- Vite로 빠른 HMR(핫 리로드) 개발 환경
- 프로덕션 빌드 결과물을 백엔드가 정적 파일로 서빙

### 차트 라이브러리 — Recharts

- React 컴포넌트 구조로 설계되어 상태 변경 시 해당 차트만 리렌더링
- Chart.js는 canvas 직접 조작 방식이라 React 상태 모델과 충돌
- 실시간으로 초당 여러 메트릭이 들어오는 환경에서 Recharts가 유리

### 스타일링 — Tailwind CSS v4 (계획)

> 현재는 커스텀 CSS 사용 중. 패널이 늘어나는 시점에 Tailwind로 전환 예정.

- 런타임 오버헤드 없음, JIT로 사용하는 클래스만 번들에 포함
- 대시보드 같은 정보 밀도 높은 UI에 유틸리티 클래스가 적합

### 상태 관리 — Zustand (계획)

> 현재는 React `useState`로 직접 관리. 패널이 여러 개가 되면 전역 스토어가 필요해짐.

- Redux 대비 보일러플레이트 없음
- 셀렉터 기반 구독으로 각 패널이 자기 메트릭만 구독 → 불필요한 리렌더링 없음
- WebSocket으로 들어온 데이터를 링 버퍼(최근 300포인트)로 저장

### 대시보드 레이아웃 — react-grid-layout (계획)

> 현재는 단일 패널. 멀티 패널 대시보드로 확장할 때 도입 예정.

- 패널 드래그&리사이즈 지원
- 레이아웃 설정을 JSON으로 직렬화해 DB에 저장/불러오기 가능

### 실시간 통신 — WebSocket

- 2초마다 CPU/네트워크, 5초마다 메모리/디스크 메트릭 푸시
- HTTP 폴링 대신 서버 → 클라이언트 단방향 스트림으로 오버헤드 최소화

---

## 데이터 흐름 요약

```
systeminformation 라이브러리 (크로스플랫폼: Windows / Linux / Mac)
        ↓ (2초 주기)
   CollectorManager
        ↓
   SQLite (원본 7일 보관 + 1시간 롤업)
        ↓
   WebSocket Hub → React 프론트엔드 → Recharts 패널
        ↓
   REST API (시간 범위 조회, 대시보드 설정, 알람 CRUD)
```

---

## 수집 메트릭 목록

| 분류 | 메트릭 이름 예시 |
|---|---|
| CPU | `cpu.usage_percent`, `cpu.core.0.usage_percent` |
| 메모리 | `mem.used_percent`, `mem.used_bytes`, `mem.swap_used_bytes` |
| 디스크 I/O | `disk.sda.read_bytes_sec`, `disk.sda.write_bytes_sec` |
| 디스크 사용량 | `disk.root.used_percent`, `disk.root.used_bytes` |
| 네트워크 | `net.eth0.rx_bytes_sec`, `net.eth0.tx_bytes_sec` |
| 시스템 | `load.avg1`, `load.avg5`, `uptime.seconds` |
| 프로세스 | `process.count`, `process.top.0.cpu_percent` |
