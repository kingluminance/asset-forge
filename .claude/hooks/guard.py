#!/usr/bin/env python3
"""PreToolUse 훅: 에이전트가 규칙 우회 수단을 쓰지 못하게 막는다. exit 2 = 차단."""
import json, re, sys

data = json.load(sys.stdin)
tool, inp = data.get("tool_name", ""), data.get("tool_input", {})

def block(msg):
    print(f"차단: {msg} (docs/conventions.md)", file=sys.stderr)
    sys.exit(2)

if tool == "Bash":
    cmd = inp.get("command", "")
    git = re.search(r"\bgit\b", cmd)
    if git and re.search(r"--no-verify\b|\bcommit\b[^;&|\"']*\s-[a-zA-Z]*n[a-zA-Z]*\b", cmd):
        block("--no-verify / commit -n 금지. 훅이 막으면 원인을 고쳐라")
    if git and re.search(r"\bpush\b", cmd):
        if re.search(r"(\s--force(?!-with-lease)\b|\s-[a-zA-Z]*f\b)", cmd):
            block("강제 push 금지. 필요하면 --force-with-lease")
        if re.search(r"\bpush\b.*\b(main|HEAD:main|:main)\b", cmd):
            block("main 직접 push 금지")
    if re.search(r"core\.hooksPath|HUSKY=0|SKIP=", cmd):
        block("훅 설정 변경/우회 금지")
    if re.search(r"\b(rm|mv)\b.*(\.githooks|\.claude/(hooks|settings))", cmd):
        block("하네스 파일 삭제/이동 금지")
    if re.search(r"\bgit\b.*\b(checkout|switch)\b.*\bmain\b.*&&.*\bcommit\b", cmd):
        block("main에서 커밋 금지")

elif tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
    path = inp.get("file_path", "")
    if re.search(r"/(\.githooks/|\.claude/hooks/|\.claude/settings\.json$|\.github/workflows/)", path):
        block("하네스·규칙 파일은 사람만 수정한다. 바꿔야 하면 이유를 보고하고 멈춰라")

sys.exit(0)
