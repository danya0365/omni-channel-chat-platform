---
name: conventions
description: มาตรฐานโค้ด/naming/git ของโปรเจค (อ่านก่อนเขียนโค้ดใหม่ หรือเมื่อสงสัยว่าควรวางไฟล์/ตั้งชื่อยังไง) — ชี้ไป code-standards rule ที่โหลดตอนแตะโค้ด
metadata:
  type: convention
  status: active
  scope: global
  updated: 2026-07-18
---

# Coding Conventions (baseline)

> มาตรฐานเต็ม (โหลดตอนแตะโค้ด) อยู่ที่ [`.claude/rules/code-standards.md`](../../rules/code-standards.md)
> + [`definition-of-done.md`](../../rules/definition-of-done.md) · ไฟล์นี้สรุปสั้นๆ
> ⚠️ **stack ยังไม่เลือก** — เมื่อเคาะแล้วให้เติมส่วนภาษา/รันไทม์/โครงสร้างจริง + ADR

## หลักที่ยึดก่อน
- **Typed & strict** — static type ทุกที่, เลี่ยง `any`/untyped boundary
- **Unified message model** — ทุกช่องทาง map เข้า/ออก schema กลางตัวเดียว; core ไม่รู้จัก payload ดิบของแต่ละเจ้า
- **Boundaries** — domain แยกจาก transport/framework; adapter ของช่องทางพึ่ง port กลาง; ทิศ dependency **app → adapter → domain** (ห้ามย้อน)
- **No secret in code** — token/webhook secret อยู่ใน env/secret store; `.env*` ต้อง gitignore
- **PII-aware** — ห้าม log ข้อความลูกค้า/PII เต็มเป็น plaintext

## Git
- ห้าม commit ตรง `main` → แตก `feature/*` เสมอ
- commit **เมื่อพี่สั่งเท่านั้น** (กฎเหล็ก AGENTS.md)
- commit message: **conventional** (`feat:`/`fix:`/`chore:`/`docs:`/`refactor:`/`test:`) เนื้อความไทยได้

## โครงสร้าง (จะ formalize เมื่อเลือก stack)
- ยังไม่มีโค้ด — คาดว่าจะแยก `channels/` (adapters), core/domain, agent inbox (frontend)
- เมื่อวางจริง → อัปเดตที่นี่ + code-standards + project-overview

## ที่ยังไม่ตกลง (TODO — เคาะกับพี่)
- เลือก stack (backend/frontend/DB/queue) → [[project-overview]]
- naming ของ unified message schema, channel id, conversation id
- โครง repo (monorepo หรือแยก), deployment, secret management
