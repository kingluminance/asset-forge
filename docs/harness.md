# 하네스 설계

AI 코딩 에이전트(Claude Code)가 이 레포를 **2주 안에, 사람 검토 최소로** 만들게 하는 작업 틀.
목표는 넥슨 AI본부 웹 FE 인턴 지원(마감 12/18)용 데모. 12/16에 배포·GIF·README 완료.

## 1. 루프: 작업 1개 = 브랜치 1개 = TDD 사이클

```
task-log에서 다음 W-XX 선택
 → cartotree locate 로 관련 파일 먼저 찾기 (grep 남발 금지)
 → [RED]    test-writer: 수용 기준 → 실패하는 테스트. 실패 확인까지
 → [GREEN]  implementer: 테스트 통과하는 최소 구현. 테스트 수정 금지
 → [REVIEW] reviewer: 경계 규칙·불필요 코드 확인. 지적 있으면 GREEN으로
 → 게이트 통과 (아래 2) → 브라우저 확인 + 스크린샷
 → [W-XX] 커밋, task-log 갱신
```

한 작업이 하루를 넘기면 쪼갠다. 게이트 실패 상태로 다음 작업으로 넘어가지 않는다.

### 1-1. TDD 규칙
- 테스트가 먼저 커밋 이력에 존재해야 한다: `[W-XX] test: ...` 커밋 다음에 `[W-XX] feat: ...`
- RED는 **올바른 이유로** 실패해야 한다 (import 에러·오타로 실패하면 RED 아님)
- 무엇을 테스트로 쓸지:
  - `core/`, `sync/` 순수 로직 → Vitest 단위 테스트 (좌표 변환, 히트테스트, Yjs 스키마 병합)
  - 캔버스·프리뷰·협업 동작 → Playwright E2E (E1~E4). 렌더 결과는 스크린샷 비교
  - Three.js 내부, React 컴포넌트 단위 렌더 → 테스트 안 씀 (E2E가 커버)
- 버그 발견 시: 재현 테스트 먼저, 그다음 수정

## 1-2. 에이전트 역할 분리 (`.claude/agents/`)

같은 에이전트가 테스트와 구현을 둘 다 쓰면 테스트를 구현에 맞춰 고치는 일이 생긴다.
그래서 쓰기 권한을 나눈다.

| 에이전트 | 하는 일 | 쓸 수 있는 곳 | 못 하는 것 |
|---|---|---|---|
| `test-writer` | 수용 기준 → 실패 테스트 | `tests/`, `src/**/*.test.ts` | `src/` 구현 수정 |
| `implementer` | 테스트 통과 최소 구현 | `src/` (테스트 파일 제외) | 테스트 수정·삭제·skip |
| `reviewer` | 경계 규칙, YAGNI, 테스트 우회 탐지 | 없음 (읽기 전용) | 코드 수정 |

메인 세션(오케스트레이터)은 직접 코드를 쓰지 않고 이 셋을 순서대로 부른다.
implementer가 테스트가 틀렸다고 판단하면 고치지 말고 이유를 보고 → 오케스트레이터가 test-writer에게 넘긴다.

## 1-3. 훅 (`.claude/settings.json`)
- **Stop 훅**: 세션이 끝날 때 `tsc --noEmit`, `vitest run` 실행. 실패하면 에이전트가 멈추지 못하고 고치러 돌아간다
- package.json 생기기 전(W-01 이전)에는 건너뜀
- Playwright는 느려서 훅에 안 넣고 커밋 전에 수동 실행

## 2. 게이트 (자동, 순서대로)

| 단계 | 명령 | 막는 것 |
|---|---|---|
| 타입 | `npx tsc --noEmit` | 타입 깨짐 |
| 린트 | `npm run lint` | 규칙 위반 |
| 단위 | `npx vitest run` | 순수 로직(좌표 변환, Yjs 스키마) 회귀 |
| E2E | `npx playwright test` | 드래그·프리뷰·협업 시나리오 |

단위 테스트는 **순수 로직에만**. 캔버스 렌더링은 E2E 스크린샷으로 본다.
E2E는 기능당 1개 시나리오만 (아래 4).

## 3. 아키텍처 경계 (에이전트가 지킬 규칙)

```
src/
  core/        순수 TS. 문서 모델, 변환 행렬, 히트테스트. React/DOM/Three import 금지
  sync/        Yjs 문서 ↔ core 모델 바인딩. y-websocket 연결
  canvas/      2D 에디터 (Canvas2D 또는 Konva). core만 참조
  preview/     Three.js 3D 프리뷰. core만 참조, canvas 참조 금지
  ai/          이미지 생성 클라이언트 (server의 프록시만 호출)
  app/         화면 조합. 여기서만 여러 모듈을 합친다
server/
  protocol.ts  프론트↔서버 계약 (공유 파일, 통합 작업만 수정)
  ws.ts        y-websocket 서버
  ai-proxy.ts  이미지 API 프록시 + 레이트 리밋
```

- 상태의 단일 원천은 **Yjs 문서**. canvas·preview는 구독만 하고 직접 서로 호출하지 않는다.
  → 협업(W-05)이 나중에 붙어도 canvas/preview 코드는 안 바뀐다. 이게 이 설계의 핵심.
- core는 DOM 없이 테스트 가능해야 한다.

## 4. 수용 기준 (E2E 시나리오 = 데모 GIF 장면)

| ID | 시나리오 | 통과 조건 |
|---|---|---|
| E1 | 에셋 드래그·리사이즈·회전 | 조작 후 core 모델 좌표가 기대값 ±1px |
| E2 | 캔버스 수정 → 3D 프리뷰 반영 | 100ms 안에 텍스처 갱신 (스크린샷 diff) |
| E3 | 두 탭 동시 편집 | 탭 A 이동이 탭 B에 반영, 충돌 없음 |
| E4 | 프롬프트 → 에셋 생성 → 캔버스 배치 | 생성 이미지가 레이어로 추가 (API는 목으로) |

## 5. 컨텍스트 공급

- `CLAUDE.md`: 규칙·명령어만. 짧게 유지 (긴 설명은 docs/로)
- `docs/project-overview.md`: 무엇을 왜 만드는지 + 공고 매핑
- `docs/task-log.md`: 작업 큐이자 진행 기록. 에이전트가 세션 시작 시 가장 먼저 읽음
- cartotree: `npx cartotree init` 로 locate/peek/links 제공. 파일 찾기는 이걸 먼저

## 6. 측정 (포트폴리오 숫자)

cartotree 때처럼 수치를 남긴다. task-log의 각 작업에 기록:
- 걸린 시간, 게이트 실패 횟수, 사람이 직접 고친 줄 수
→ README에 "에이전트 하네스로 2주 만에 구현, 수정 개입 N%" 한 줄. 넥슨 AI본부에 먹히는 이야기.

## 7. 컷 순서 (시간 부족 시)

W-05 협업(Yjs) → W-06 AI 생성 → 프리뷰를 단순 평면으로.
W-01~W-04 + 배포는 절대 안 자른다.
