# CLAUDE.md

asset-forge: 브라우저 게임 에셋 에디터 (캔버스 + Three.js 프리뷰 + Yjs 협업 + AI 생성).
무엇을/왜는 [docs/project-overview.md](./docs/project-overview.md), 작업 방식은 [docs/harness.md](./docs/harness.md).

## 세션 시작 시
1. [docs/task-log.md](./docs/task-log.md)에서 맨 위 `todo` 작업을 집고 `doing`으로 바꾼다
2. 파일 찾기는 cartotree(`locate`/`peek`/`links`) 먼저, grep은 그다음

## TDD: 메인 세션은 코드를 직접 쓰지 않는다
`.claude/agents/`의 서브에이전트를 순서대로 부른다 ([docs/harness.md](./docs/harness.md) 1-1, 1-2):
1. `test-writer` → 실패 테스트 (RED 확인). 커밋 `[W-XX] test: ...`
2. `implementer` → 최소 구현 (GREEN). 테스트 수정 금지. 커밋 `[W-XX] feat: ...`
3. `reviewer` → 지적 있으면 2로
4. `qa` → 실제 브라우저로 수용 기준 확인. 실패면 2로
5. PR → CodeRabbit 리뷰 대응(버그·보안·경계는 수정, 취향은 근거 답글) → `gh pr merge --auto --rebase`
   CI gate가 초록이 될 때까지 GitHub이 머지를 보류한다. 다른 머지 방식은 가드가 막는다

implementer가 "테스트가 틀렸다"고 보고하면 test-writer에게 넘긴다. 직접 고치지 않는다.
Stop 훅이 tsc·vitest를 돌린다. 실패하면 끝낼 수 없다.

## 명령어
```sh
npm run dev              # 개발 서버
npx tsc --noEmit         # 타입
npm run lint             # 린트
npx vitest run           # 단위 (core/, sync/)
npx playwright test      # E2E (E1~E4)
```
커밋 전 네 개 모두 통과. 실패한 채로 다음 작업 금지.

## 아키텍처 규칙
- `core/`: 순수 TS. React·DOM·Three import 금지
- `canvas/`, `preview/`: `core/`만 참조. 서로 직접 참조 금지
- 상태의 단일 원천은 Yjs 문서. 모듈 간 통신은 문서 구독으로만
  - 예외: 탭마다 달라야 하는 UI 상태(선택 등)는 문서에 넣지 않고 `app/`에서 props·콜백으로 조합한다. 문서 데이터는 예외 없이 스토어만 거친다
- 여러 모듈 조합은 `app/`에서만
- 스택 고정: Vite + React + TS. Next.js, 상태관리 라이브러리 추가 금지

## 브랜치·커밋·PR — 전부 강제됨 ([docs/conventions.md](./docs/conventions.md))
- 브랜치: `<feat|fix|test|refactor|chore|docs>/W-XX-kebab-설명`. main 직접 커밋·push 금지
- 커밋: `[W-XX] <type>(<scope>): 설명` — scope는 `core sync canvas preview ai app server e2e harness deps`
- 같은 W-XX에서 `test` 커밋이 `feat`/`fix`보다 먼저. merge 커밋 금지(rebase)
- PR: 제목 = 커밋 형식, 템플릿 체크리스트 전부, 400줄 이하, rebase merge
- 막히면 우회하지 말고 원인을 고친다. `--no-verify`, 강제 push, 훅 수정은 훅이 차단한다
- `.githooks/`, `.claude/hooks/`, `.claude/settings.json`, `.github/workflows/`는 사람만 수정
- 완료 시 task-log에 시간·게이트 실패 횟수·수동 수정 줄 수 기록

## 멀티 에이전트
- 에이전트 하나 = W-XX 하나 = worktree 하나. task-log `모듈` 열이 겹치면 병렬 금지
- 공유 파일(`package.json`, `src/core/types.ts`, `server/protocol.ts`)은 통합 작업이 먼저 혼자 바꾼다
- 머지는 하나씩. 머지 후 남은 브랜치는 main 위로 rebase 후 게이트 재실행

## 백엔드 (`server/`)
y-websocket 서버(W-05)와 AI API 프록시(W-06). 프론트는 `src/sync/`, `src/ai/`에서만 서버를 부른다.
계약은 `server/protocol.ts` 한 파일. API 키는 서버 환경변수에만.

## 범위 밖
로그인, DB, 모바일, 디자인 다듬기. 요청 없으면 만들지 않는다.
