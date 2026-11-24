#!/bin/sh
# Stop 훅: 타입·단위 테스트가 깨진 채로 에이전트가 멈추지 못하게 한다.
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -f package.json ] || exit 0   # W-01 전에는 건너뜀

# 한 번 되돌려 보냈는데도 또 실패하면 무한 루프 방지로 통과시킨다
# ponytail: 재시도 1회 고정, 필요하면 카운터 파일로 늘리기
if grep -q '"stop_hook_active": *true'; then exit 0; fi

out=$( { npx tsc --noEmit && npx vitest run --reporter=dot; } 2>&1 ) || {
  printf '게이트 실패. 고치고 끝내라:\n%s\n' "$(printf '%s' "$out" | tail -40)" >&2
  exit 2
}
