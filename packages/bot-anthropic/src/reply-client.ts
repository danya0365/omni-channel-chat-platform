import { z } from 'zod';
import { err, ok } from '@omni/domain';
import type { BotAiDecision, BotAiReplier } from '@omni/domain';

/**
 * @omni/bot-anthropic — adapter ถาม Claude API ช่วยตอบลูกค้า (Phase 5B · implement BotAiReplier)
 *
 * ⭐ RAW FETCH (ไม่ใช่ @anthropic-ai/sdk) — use case แคบ = 1 POST non-streaming (ADR-0006):
 *   freeze `anthropic-version` + hardcode model + ครอบ response ด้วย zod → ปิดความเสี่ยง "เดา API ผิด"
 * ⚠️ Opus 4.8: ห้ามส่ง temperature/top_p/top_k (400) · omit `thinking` = ปิด thinking (ตอบเร็ว/สั้น)
 *   → system prompt สั่งตอบตรงๆ กัน reasoning รั่วเข้า visible response
 * ⚠️ PII: ส่งเฉพาะข้อความลูกค้า · ไม่ log prompt/response เต็ม (ดู AGENTS.md)
 */

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
/** freeze model — use case นี้ต้องการแค่ตอบสั้น deterministic (ADR-0006) */
const MODEL = 'claude-opus-4-8';
/** ตอบสั้น → max_tokens ต่ำ (ประหยัด cost + latency) */
const DEFAULT_MAX_TOKENS = 512;
/** AI ตอบ sentinel นี้เมื่อยอมแพ้ → bot escalate หา human */
const ESCALATE_SENTINEL = '[[ESCALATE]]';

const SYSTEM_PROMPT = [
  'คุณเป็นผู้ช่วยตอบแชทลูกค้าของร้านค้าออนไลน์ ตอบเป็นภาษาไทย สั้น กระชับ สุภาพ เป็นกันเอง',
  'กติกา:',
  '- ถ้าตอบ/ช่วยเหลือลูกค้าได้ ให้ตอบ "ข้อความถึงลูกค้า" โดยตรงเท่านั้น ไม่ต้องมีคำนำ ไม่ต้องอธิบายเหตุผลของคุณ',
  `- ถ้าคำถามต้องใช้ข้อมูลเฉพาะบัญชี/ออเดอร์ ต้องดำเนินการ (คืนเงิน/ยกเลิก/เปลี่ยน/ร้องเรียน) หรือคุณไม่มั่นใจ ให้ตอบว่า ${ESCALATE_SENTINEL} เท่านั้น`,
  '- ห้ามแต่ง/เดาข้อมูลที่ไม่รู้จริง',
].join('\n');

/** response subset ที่ client นี้ใช้ — Response ของ global fetch assignable (structural) */
export interface AnthropicHttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** fetch seam — inject เพื่อ test hermetic (ไม่ยิง api.anthropic.com จริง) */
export type AnthropicFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<AnthropicHttpResponse>;

const defaultFetch: AnthropicFetch = (url, init) => fetch(url, init);

export interface AnthropicReplierConfig {
  /** ANTHROPIC_API_KEY (ผ่าน env — ห้าม hardcode/commit) */
  apiKey: string;
  /** override fetch (test) — default = global fetch */
  fetch?: AnthropicFetch;
  /** จำกัดความยาวคำตอบ — default 512 (ตอบสั้น) */
  maxTokens?: number;
}

/** ครอบ response ของ /v1/messages เท่าที่ใช้ (content text blocks + stop_reason) */
const responseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  stop_reason: z.string().nullish(),
});
type AnthropicResponse = z.infer<typeof responseSchema>;

/** แปลง response → decision · refusal/ว่าง/sentinel = escalate · มีข้อความ = reply */
function decide(data: AnthropicResponse): BotAiDecision {
  if (data.stop_reason === 'refusal') return { kind: 'escalate' };
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
  if (text === '' || text.startsWith(ESCALATE_SENTINEL)) return { kind: 'escalate' };
  return { kind: 'reply', text };
}

/**
 * createAnthropicBotReplier — implement BotAiReplier ด้วย raw POST /v1/messages
 * network error / non-2xx / parse fail → err (bot consumer แปลงเป็น escalate) · ไม่ throw
 */
export function createAnthropicBotReplier(config: AnthropicReplierConfig): BotAiReplier {
  const doFetch = config.fetch ?? defaultFetch;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  return {
    reply: async (input) => {
      try {
        const response = await doFetch(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: maxTokens,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: input.text }],
          }),
        });
        if (!response.ok) {
          return err({ code: 'ai_failed', message: `anthropic HTTP ${response.status}` });
        }
        const parsed = responseSchema.safeParse(await response.json());
        if (!parsed.success) {
          return err({ code: 'ai_failed', message: 'anthropic response parse error' });
        }
        return ok(decide(parsed.data));
      } catch (error) {
        return err({
          code: 'ai_failed',
          message: error instanceof Error ? error.message : 'anthropic network error',
        });
      }
    },
  };
}
