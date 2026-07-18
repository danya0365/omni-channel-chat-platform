#!/usr/bin/env bash
# Stop hook — เตือนเบาๆ ให้ commit เมื่อมีไฟล์ค้างใน working tree
# ไม่บล็อกอะไร แค่ echo ออก stderr ให้เห็น
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

# นับไฟล์ที่เปลี่ยน (tracked + untracked) เลี่ยง error ถ้าไม่ใช่ git repo
count="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

if [ "${count:-0}" -gt 0 ]; then
  echo "📝 มี ${count} ไฟล์ที่ยังไม่ commit — อย่าลืม git add/commit เมื่อถึงจุดที่เหมาะ" >&2
fi

exit 0
