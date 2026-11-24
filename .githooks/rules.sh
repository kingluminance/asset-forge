#!/bin/sh
# 훅·CI가 같이 쓰는 규칙. 규칙 바꾸면 docs/conventions.md도 같이 고친다.
TYPES='feat|fix|test|refactor|chore|docs|perf'
SCOPES='core|sync|canvas|preview|ai|app|server|e2e|harness|deps'
BRANCH_RE="^(feat|fix|test|refactor|chore|docs)/W-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$"
SUBJECT_RE="^\[W-[0-9]{2}\] ($TYPES)\(($SCOPES)\): [^ ].*[^.]$"

fail() { printf '\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# 제목 한 줄 검사 (commit-msg와 CI의 PR 제목 검사가 공유)
check_subject() {
  printf '%s' "$1" | grep -Eq "$SUBJECT_RE" ||
    fail "형식 위반: '$1'
  필요: [W-XX] <$TYPES>(<$SCOPES>): 설명   (끝에 마침표 없음)"
  n=$(printf '%s' "$1" | LC_ALL=en_US.UTF-8 wc -m | tr -d ' ')
  [ "$n" -le 72 ] || fail "첫 줄 ${n}자 > 72자"
}

# TDD 순서: 범위 안 각 W-XX마다 첫 feat/fix 이전에 test 커밋이 있어야 한다
check_tdd() {
  git log --reverse --format=%s "$1" | awk '
    match($0, /^\[W-[0-9][0-9]\] [a-z]+/) {
      id = substr($0, 2, 4); t = substr($0, 8, RLENGTH - 7)
      if (t == "test") seen[id] = 1
      if ((t == "feat" || t == "fix") && !seen[id]) {
        printf "TDD 순서 위반: %s 의 test 커밋보다 %s 커밋이 먼저: %s\n", id, t, $0; bad = 1
      }
    }
    END { exit bad }' >&2 || exit 1
}
