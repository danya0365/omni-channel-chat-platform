# SETUP — ตั้งค่าเครื่องใหม่ (AI agent / Claude Code)

โปรเจคนี้เก็บ config ของผู้ช่วย AI (**Iris**) ไว้ใน git ทั้งหมด (ดู [ADR-0001](.claude/memory/decisions/0001-agent-toolkit.md))
เมื่อ `git clone` เครื่องใหม่ ทำตามนี้:

## 1. กด accept workspace-trust (บังคับ)

เปิดโปรเจคใน Claude Code แล้ว **กด accept workspace-trust 1 ครั้ง** —
ค่า `autoMemoryDirectory` และ hooks (`format.sh`, `commit-reminder.sh`) ถึงจะทำงาน

## 2. ตรวจ path ของ memory

`.claude/settings.json` → `autoMemoryDirectory` ชี้ `~/omni-channel-chat-platform/.claude/memory`
ถ้าพี่ clone ไปไว้ที่อื่น/เปลี่ยนชื่อโฟลเดอร์ → แก้ค่านี้ให้ตรง (จุดเดียว)

## 3. Hooks (auto-format) — ต้องมี Prettier ถึงจะ format

hook `format.sh` เรียก `npx --no-install prettier` — ถ้ายังไม่มี Prettier ในโปรเจค hook จะเงียบ (ไม่ error)
ติดตั้งเมื่อเลือก stack แล้ว: `npm i -D prettier`

## 4. (ถ้าจะใช้) MCP — GitHub server

1. `cp .mcp.json.example .mcp.json` (`.mcp.json` ถูก gitignore)
2. สร้าง GitHub personal access token แล้วใส่ใน `.claude/settings.local.json`:
   ```json
   { "env": { "GITHUB_TOKEN": "ghp_xxx" } }
   ```
3. รีสตาร์ท session

## 5. Model / auth

โปรเจคนี้ **ใช้ auth/model ปกติของ Claude Code** (ไม่ได้ตั้ง local proxy)
ถ้าอยากตั้งค่า env เฉพาะเครื่อง → สร้าง `.claude/settings.local.json` (gitignore) เอง

---

## ไฟล์ที่ gitignore (สร้างใหม่ต่อเครื่อง)

- `.claude/settings.local.json` — env/ค่าเฉพาะเครื่อง (เช่น GITHUB_TOKEN)
- `.mcp.json` — config MCP จริง (คัดจาก `.mcp.json.example`)
- `CLAUDE.local.md` — note ส่วนตัวต่อเครื่อง (ถ้ามี)
