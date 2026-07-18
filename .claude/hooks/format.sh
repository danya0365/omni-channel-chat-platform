#!/usr/bin/env bash
# PostToolUse hook — รัน Prettier กับไฟล์ที่เพิ่งถูก Edit/Write
# รับ JSON ของ tool ทาง stdin; ดึง path ของไฟล์ออกมา format เฉพาะที่ Prettier รองรับ
set -euo pipefail

input="$(cat)"

# ดึง file path จาก JSON (รองรับทั้ง tool_input.file_path และ tool_input.path)
file="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -z "$file" ] && file="$(printf '%s' "$input" | sed -n 's/.*"path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

# ไม่มี path หรือไฟล์ไม่มีจริง → จบเงียบๆ
[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

# format เฉพาะนามสกุลที่ Prettier ดูแล
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.scss|*.md|*.mdx|*.html|*.yaml|*.yml)
    cd "${CLAUDE_PROJECT_DIR:-.}"
    # --ignore-unknown + เคารพ .prettierignore; เงียบถ้า prettier ยังไม่ติดตั้ง
    npx --no-install prettier --write --ignore-unknown "$file" >/dev/null 2>&1 || true
    ;;
esac

exit 0
