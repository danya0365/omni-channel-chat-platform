// @omni/bot-anthropic — adapter ถาม Claude API (Messages) ช่วยตอบลูกค้า (Phase 5B)
// implement BotAiReplier ของ @omni/domain · RAW FETCH + inject fetch seam (test hermetic)
// พึ่งได้แค่ @omni/domain + zod — ไม่ผูก framework/adapter อื่น (บังคับด้วย dependency-cruiser) · ดู ADR-0006

export * from './reply-client';
