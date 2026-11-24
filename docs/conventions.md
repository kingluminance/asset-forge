# 개발 규칙 (강제)

여기 적힌 규칙은 **권고가 아니라 차단**이다. 어기면 git 훅·Claude 훅·CI 중 하나가 막는다.
"어디서 막히나" 열이 비어 있는 규칙은 없다.

## 1. 브랜치

| 규칙 | 어디서 막히나 |
|---|---|
| 이름: `<type>/W-XX-<kebab-설명>` (예: `feat/W-02-canvas-drag`) | pre-commit, CI |
| type: `feat` `fix` `test` `refactor` `chore` `docs` | pre-commit |
| `main` 직접 커밋·푸시 금지 | pre-commit, pre-push, Claude 훅 |
| 브랜치 하나 = 작업 ID 하나. 다른 W-XX 커밋 섞기 금지 | commit-msg |
| 강제 푸시 금지 (`--force`, `-f`). 필요하면 `--force-with-lease`만 | Claude 훅 |
| `main` 기준으로 rebase. merge 커밋 금지 | pre-push |

## 2. 커밋

형식:
```
[W-XX] <type>(<scope>): <설명>
```
- type: `feat` `fix` `test` `refactor` `chore` `docs` `perf`
- scope: `core` `sync` `canvas` `preview` `ai` `app` `server` `e2e` `harness` `deps`
- 설명: 한국어 가능, 첫 줄 72자 이하, 마침표 없음, 명령형/명사형 ("추가", "수정")
- 예: `[W-02] test(core): 회전 변환 행렬 실패 테스트`, `[W-02] feat(canvas): 드래그·리사이즈 핸들`

| 규칙 | 어디서 막히나 |
|---|---|
| 위 형식 | commit-msg |
| W-XX가 브랜치 이름의 ID와 같아야 함 | commit-msg |
| **TDD 순서**: 같은 W-XX에서 `test` 커밋이 첫 `feat`/`fix` 커밋보다 먼저 | pre-push, CI |
| `--no-verify` 금지 | Claude 훅 |
| 커밋 하나 = 의도 하나. 테스트 통과 상태로만 커밋 (`test` 커밋 제외) | pre-commit (tsc·lint) |
| 시크릿 커밋 금지 (`.env`, API 키 패턴) | pre-commit |
| `.only` / `.skip` 커밋 금지 | pre-commit |

## 3. PR

| 규칙 | 어디서 막히나 |
|---|---|
| 제목 = 커밋 형식 (`[W-XX] feat(canvas): ...`) | CI |
| 본문은 [PR 템플릿](../.github/pull_request_template.md) 체크리스트 전부 채움 | CI (빈 체크박스 있으면 실패) |
| 변경 400줄 이하 (lock 파일 제외). 넘으면 작업 쪼개기 | CI |
| CI 게이트 전부 초록: tsc, lint, vitest, playwright, TDD 순서 | CI (required check) |
| `reviewer` 에이전트 "통과" 결과를 PR 코멘트로 첨부 | 템플릿 체크 |
| 머지 방식: **rebase merge만**. squash 금지 (test→feat 이력 보존) | GitHub 설정 |
| 머지 후 브랜치 삭제 | GitHub 설정 |

GitHub 레포 만들면 `main` 브랜치 보호 켜기: required checks = `gate`, 직접 push 금지, linear history.

## 4. 멀티 에이전트

| 규칙 | 이유 |
|---|---|
| 에이전트 하나 = W-XX 하나 = **worktree 하나** (`isolation: worktree`) | 같은 파일 동시 수정 방지 |
| 병렬 작업은 **모듈이 안 겹칠 때만**. 작업 시작 전 task-log의 `모듈` 열 확인 | 충돌 방지 |
| 공유 파일(`package.json`, `src/core/types.ts`, `server/protocol.ts`)은 **통합 작업**이 먼저 혼자 바꾼다. 병렬 에이전트는 읽기만 | 공유 지점 충돌 차단 |
| 각 worktree에서 TDD 3단계(test-writer → implementer → reviewer) 그대로 | 품질 동일 |
| 머지는 오케스트레이터가 하나씩, 머지 후 다음 브랜치는 `main` 위로 rebase하고 게이트 재실행 | 통합 버그 조기 발견 |

## 5. 백엔드 (`server/`)

프론트만으로 안 되는 두 가지 때문에 필요하다:
- **W-05 협업**: y-websocket 서버
- **W-06 AI 생성**: 이미지 API 키를 브라우저에 노출하면 안 됨 → 서버가 프록시

| 규칙 | |
|---|---|
| Node + TypeScript, 프레임워크 최소 (`ws` + `node:http`). Express 추가는 필요해질 때 | YAGNI |
| 프론트↔서버 계약은 `server/protocol.ts` 한 파일. 프론트는 `src/ai/`, `src/sync/`에서만 서버를 부른다 | 경계 |
| API 키는 서버 환경변수만. `.env`는 커밋 금지, `.env.example`만 | 보안 |
| 서버도 TDD: 프록시·메시지 처리 로직은 Vitest, WS 연결은 E2E(E3) | 품질 |
| 레이트 리밋: AI 프록시에 IP당 분당 N회 | 데모 공개 시 키 남용 방지 |
