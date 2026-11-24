## 작업
<!-- task-log의 W-XX와 수용 기준 (E1~E4 중 해당) -->

## 무엇을 / 왜

## 확인 방법
<!-- 재현 명령, 스크린샷·GIF -->

## 체크리스트 (전부 체크해야 CI 통과)
- [ ] 제목이 `[W-XX] type(scope): 설명` 형식
- [ ] test 커밋이 feat/fix 커밋보다 먼저 (TDD)
- [ ] tsc · lint · vitest · playwright 로컬 통과
- [ ] 모듈 경계 위반 없음 (core 순수, canvas↔preview 직접 참조 없음)
- [ ] reviewer 에이전트 결과 "통과"를 아래에 붙임
- [ ] task-log에 시간·게이트 실패·수동 수정 줄 수 기록

## reviewer 결과
