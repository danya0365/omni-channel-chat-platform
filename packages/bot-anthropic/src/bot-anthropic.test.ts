import { describe, expect, it } from 'vitest';
import { createAnthropicBotReplier } from './reply-client';
import type { AnthropicFetch } from './reply-client';

/** fake Anthropic response (json body) — hermetic ไม่ยิง network จริง */
const fakeFetch =
  (body: unknown, opts: { ok?: boolean; status?: number } = {}): AnthropicFetch =>
  async () => ({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => body,
  });

const textReply = (text: string, stop_reason = 'end_turn') => ({
  content: [{ type: 'text', text }],
  stop_reason,
});

describe('createAnthropicBotReplier (raw fetch · Phase 5B)', () => {
  it('ส่ง request ถูก shape — POST /v1/messages · x-api-key · version header · model opus-4-8 · ไม่มี sampling param', async () => {
    let captured: { url: string; init: Parameters<AnthropicFetch>[1] } | undefined;
    const spyFetch: AnthropicFetch = async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => textReply('ok') };
    };
    const replier = createAnthropicBotReplier({ apiKey: 'sk-test-123', fetch: spyFetch });
    await replier.reply({ text: 'สวัสดี' });

    expect(captured?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(captured?.init.method).toBe('POST');
    expect(captured?.init.headers['x-api-key']).toBe('sk-test-123');
    expect(captured?.init.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(captured?.init.body ?? '{}');
    expect(body.model).toBe('claude-opus-4-8');
    expect(body.messages).toEqual([{ role: 'user', content: 'สวัสดี' }]);
    expect(typeof body.system).toBe('string');
    // Opus 4.8: ห้ามส่ง sampling params (400) — ต้องไม่มีใน body
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
    expect(body).not.toHaveProperty('top_k');
    expect(body).not.toHaveProperty('thinking'); // omit = ปิด thinking (ตอบสั้น/เร็ว)
  });

  it('AI ตอบข้อความ → decision reply (trim) ', async () => {
    const replier = createAnthropicBotReplier({
      apiKey: 'k',
      fetch: fakeFetch(textReply('  เปิด 9 โมงครับ  ')),
    });
    const result = await replier.reply({ text: 'ร้านเปิดกี่โมง' });
    expect(result.ok && result.value).toEqual({ kind: 'reply', text: 'เปิด 9 โมงครับ' });
  });

  it('AI ตอบ sentinel [[ESCALATE]] → decision escalate', async () => {
    const replier = createAnthropicBotReplier({
      apiKey: 'k',
      fetch: fakeFetch(textReply('[[ESCALATE]]')),
    });
    const result = await replier.reply({ text: 'ขอคืนเงิน' });
    expect(result.ok && result.value).toEqual({ kind: 'escalate' });
  });

  it('stop_reason refusal → decision escalate (safety)', async () => {
    const replier = createAnthropicBotReplier({
      apiKey: 'k',
      fetch: fakeFetch({ content: [], stop_reason: 'refusal' }),
    });
    const result = await replier.reply({ text: 'x' });
    expect(result.ok && result.value).toEqual({ kind: 'escalate' });
  });

  it('content ว่าง (ไม่มี text block) → decision escalate', async () => {
    const replier = createAnthropicBotReplier({
      apiKey: 'k',
      fetch: fakeFetch({ content: [], stop_reason: 'end_turn' }),
    });
    const result = await replier.reply({ text: 'x' });
    expect(result.ok && result.value).toEqual({ kind: 'escalate' });
  });

  it('non-2xx → err ai_failed (bot consumer แปลงเป็น escalate)', async () => {
    const replier = createAnthropicBotReplier({
      apiKey: 'k',
      fetch: fakeFetch({}, { ok: false, status: 429 }),
    });
    const result = await replier.reply({ text: 'x' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('ai_failed');
    expect(!result.ok && result.error.message).toContain('429');
  });

  it('network throw → err ai_failed (ไม่ throw ออกมา)', async () => {
    const throwingFetch: AnthropicFetch = async () => {
      throw new Error('boom');
    };
    const replier = createAnthropicBotReplier({ apiKey: 'k', fetch: throwingFetch });
    const result = await replier.reply({ text: 'x' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('ai_failed');
  });

  it('response shape ผิด (parse fail) → err ai_failed', async () => {
    const replier = createAnthropicBotReplier({
      apiKey: 'k',
      fetch: fakeFetch({ unexpected: true }),
    });
    const result = await replier.reply({ text: 'x' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain('parse');
  });

  it('maxTokens override เข้า body', async () => {
    let body: Record<string, unknown> = {};
    const spyFetch: AnthropicFetch = async (_url, init) => {
      body = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => textReply('ok') };
    };
    const replier = createAnthropicBotReplier({ apiKey: 'k', fetch: spyFetch, maxTokens: 128 });
    await replier.reply({ text: 'x' });
    expect(body.max_tokens).toBe(128);
  });
});
