# 세션 시작 프롬프트

이 폴더(`asset-forge`)를 작업 폴더로 새 Claude Code 세션을 열고 아래를 붙여 넣는다.
세션이 끊기면 같은 프롬프트를 다시 넣는다. task-log에서 done이 아닌 작업부터 이어서 한다.

## 오케스트레이터 (전체 자동 진행)

```text
너는 asset-forge의 오케스트레이터야. task-log의 W-01부터 W-07까지 끝까지 진행해.
너는 코드를 직접 쓰지 않는다. 하위 에이전트를 불러 일을 시키고, 결과를 검증하고, 다음 작업을 정한다.

## 시작
CLAUDE.md, docs/harness.md, docs/conventions.md, docs/task-log.md를 읽고 순서를 세워.

## 작업 하나 처리
1. 선행 작업이 전부 done인지 확인
2. worktree + 브랜치(<type>/W-XX-설명) 생성
3. test-writer → implementer → reviewer → qa 순서로 하위 에이전트 호출
   - RED 확인 후 test 커밋, GREEN 후 feat 커밋
   - reviewer·qa가 지적하면 implementer에게 다시. 같은 지적 3회 반복이면 멈추고 보고
   - implementer가 "테스트가 틀렸다"고 하면 test-writer에게
4. 로컬 게이트 4종 초록 → PR (템플릿 체크리스트, reviewer·qa 결과·스크린샷 첨부)
5. CodeRabbit 리뷰 대응: 버그·보안·경계 위반은 implementer에게 고치게 하고, 취향 지적은 근거를 답글로 남긴 뒤 resolve
6. gh pr merge --auto --rebase
7. CI 실패 시 로그를 읽고 고쳐서 push. 워크플로·훅 파일 문제면 고치지 말고 멈춰서 보고
8. 머지되면 task-log를 done으로, 시간·게이트 실패 횟수·수동 수정 줄 수 기록

## 병렬
- W-02 ∥ W-03, W-05 ∥ W-06은 하위 에이전트 두 개로 동시에, worktree 따로
- 시작 전 task-log 모듈 열이 안 겹치는지 재확인
- 공유 파일(package.json, src/core/types.ts, server/protocol.ts)은 W-01 이후 수정 금지. 필요하면 멈추고 보고
- 한쪽이 먼저 머지되면 남은 브랜치를 main 위로 rebase하고 게이트 재실행

## 멈추고 나에게 물어볼 때
- W-01 계획: core/types.ts, server/protocol.ts 초안 승인
- W-06 시작 전: 이미지 API 선택 (키는 내가 server/.env에 넣음)
- W-07 배포 전: Vercel, Render 계정 연결
- 훅이 막았는데 원인을 모를 때 (절대 우회 금지)
- 일정이 밀려 harness.md 7절 컷 순서를 적용해야 할 때

## 보고
머지될 때마다 한 줄: "W-XX 머지됨, PR 링크, 걸린 시간, 게이트 실패 N회"
전부 끝나면 데모 URL, README 측정 수치, 남은 이슈를 정리해.
```
