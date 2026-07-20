import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '@omni/domain';
import { verifyLineSignature } from './signature';
import { toIngestCommands } from './inbound';
import { createLineCredentialResolver } from './credentials';
import { createLineOutboundGateway } from './outbound-gateway';
import type { LinePushClient, LineRouteResolver } from './outbound-gateway';
import { createLineHttpPushClient } from './push-client';
import type { LineFetch, LineHttpResponse } from './push-client';
import { lineRetryKey } from './retry-key';

const CHANNEL_SECRET = 'test-channel-secret-สมมติ';

/** fixture: LINE webhook body ที่มี text message 1 ตัว (โครงตาม LINE Messaging API docs) */
const lineWebhookFixture = {
  destination: 'U0123456789abcdef0123456789abcdef',
  events: [
    {
      type: 'message',
      mode: 'active',
      timestamp: 1625665242211,
      source: { type: 'user', userId: 'U80696558e1aa831...' },
      webhookEventId: '01FZ74A0TDDPYRVKNK77XKC3ZR',
      deliveryContext: { isRedelivery: false },
      replyToken: '757913772c4646b784d4b7ce46d12671',
      message: { type: 'text', id: '14353798921116', text: 'สวัสดีครับ' },
    },
  ],
};

/** เซ็น body เหมือน LINE (HMAC-SHA256 ของ raw string → base64) */
function signBody(rawBody: string, secret = CHANNEL_SECRET): string {
  return createHmac('sha256', secret).update(rawBody).digest('base64');
}

describe('verifyLineSignature', () => {
  const rawBody = JSON.stringify(lineWebhookFixture);

  it('signature ถูกต้อง (คำนวณจาก raw body + secret เดียวกัน) → true', () => {
    expect(verifyLineSignature(rawBody, signBody(rawBody), CHANNEL_SECRET)).toBe(true);
  });

  it('secret ผิด → false', () => {
    expect(verifyLineSignature(rawBody, signBody(rawBody, 'secret-ผิด'), CHANNEL_SECRET)).toBe(
      false,
    );
  });

  it('body ถูกแก้หลังเซ็น (tamper) → false', () => {
    const signature = signBody(rawBody);
    const tampered = rawBody.replace('สวัสดีครับ', 'โดนแก้');
    expect(verifyLineSignature(tampered, signature, CHANNEL_SECRET)).toBe(false);
  });

  it('signature หาย (undefined) → false (ไม่ throw)', () => {
    expect(verifyLineSignature(rawBody, undefined, CHANNEL_SECRET)).toBe(false);
  });

  it('รับ Buffer (raw byte) ได้เหมือน string', () => {
    const buf = Buffer.from(rawBody, 'utf8');
    expect(verifyLineSignature(buf, signBody(rawBody), CHANNEL_SECRET)).toBe(true);
  });
});

describe('toIngestCommands', () => {
  const ctx = { workspaceId: 'ws_1', channelId: 'chn_line' } as const;

  it('map text message → ingest command (userId→externalId, text→content, message.id→externalMessageId)', () => {
    const commands = toIngestCommands(lineWebhookFixture, ctx);
    expect(commands).toEqual([
      {
        workspaceId: 'ws_1',
        channelId: 'chn_line',
        externalId: 'U80696558e1aa831...',
        content: { type: 'text', text: 'สวัสดีครับ' },
        contactName: null,
        externalMessageId: '14353798921116',
      },
    ]);
  });

  it('ข้าม event ที่ไม่ใช่ text message (sticker/follow/postback) — ingest เฉพาะ text', () => {
    const body = {
      events: [
        { type: 'follow', source: { type: 'user', userId: 'U1' }, replyToken: 'r' },
        {
          type: 'message',
          source: { type: 'user', userId: 'U2' },
          message: { type: 'sticker', id: '1', packageId: '1', stickerId: '1' },
        },
        {
          type: 'message',
          source: { type: 'user', userId: 'U3' },
          message: { type: 'text', id: '99', text: 'ทักจริง' },
        },
      ],
    };
    const commands = toIngestCommands(body, ctx);
    expect(commands).toHaveLength(1);
    expect(commands[0]?.externalId).toBe('U3');
    expect(commands[0]?.content).toEqual({ type: 'text', text: 'ทักจริง' });
  });

  it('หลาย text message ใน batch เดียว → หลาย command', () => {
    const body = {
      events: [
        {
          type: 'message',
          source: { type: 'user', userId: 'U1' },
          message: { type: 'text', id: '1', text: 'a' },
        },
        {
          type: 'message',
          source: { type: 'user', userId: 'U2' },
          message: { type: 'text', id: '2', text: 'b' },
        },
      ],
    };
    expect(toIngestCommands(body, ctx)).toHaveLength(2);
  });

  it('body ผิดรูป / ไม่มี events → [] (ไม่ throw — webhook ต้องตอบ 200)', () => {
    expect(toIngestCommands({ foo: 'bar' }, ctx)).toEqual([]);
    expect(toIngestCommands(null, ctx)).toEqual([]);
    expect(toIngestCommands('not-json-object', ctx)).toEqual([]);
  });

  it('text ว่าง → ข้าม (กัน ingest reject)', () => {
    const body = {
      events: [
        {
          type: 'message',
          source: { type: 'user', userId: 'U1' },
          message: { type: 'text', id: '1', text: '' },
        },
      ],
    };
    expect(toIngestCommands(body, ctx)).toEqual([]);
  });
});

describe('createLineCredentialResolver', () => {
  it('raw blob ถูก shape → parse เป็น LineCredentials', async () => {
    const resolver = createLineCredentialResolver(async () => ({
      channelAccessToken: 'tok',
      channelSecret: 'sec',
    }));
    expect(await resolver('ws_1', 'chn_line')).toEqual({
      channelAccessToken: 'tok',
      channelSecret: 'sec',
    });
  });

  it('ไม่มี row (null) → null', async () => {
    const resolver = createLineCredentialResolver(async () => null);
    expect(await resolver('ws_1', 'chn_line')).toBeNull();
  });

  it('blob ผิด shape (ขาด field) → throw (config พัง ควรรู้)', async () => {
    const resolver = createLineCredentialResolver(async () => ({ channelAccessToken: 'tok' }));
    await expect(resolver('ws_1', 'chn_line')).rejects.toThrow();
  });
});

const outboundMessage: Message = {
  id: 'msg_1',
  workspaceId: 'ws_1',
  conversationId: 'conv_1',
  channelId: 'chn_line',
  direction: 'outbound',
  sender: { kind: 'agent', agentId: 'agt_1' },
  content: { type: 'text', text: 'ตอบกลับจาก inbox' },
  status: 'sent',
  externalId: null,
  createdAt: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)),
};

const creds = { channelAccessToken: 'access-token-สมมติ', channelSecret: 'sec' };

describe('createLineOutboundGateway', () => {
  it('resolve userId + มี credential → push แล้ว delivered=true + externalId=requestId', async () => {
    const push: LinePushClient = vi.fn(async () => ({ ok: true as const, requestId: 'req-123' }));
    const resolveRoute: LineRouteResolver = vi.fn(async () => 'U80696558e1aa831...');
    const gateway = createLineOutboundGateway({
      resolveRoute,
      resolveCredentials: async () => creds,
      push,
    });

    const res = await gateway.send(outboundMessage);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(true);
    expect(res.value.externalId).toBe('req-123');
    expect(push).toHaveBeenCalledWith({
      accessToken: 'access-token-สมมติ',
      to: 'U80696558e1aa831...',
      messages: [{ type: 'text', text: 'ตอบกลับจาก inbox' }],
      // idempotency key derive จาก message.id (retry ปลอดภัย)
      retryKey: lineRetryKey('msg_1'),
    });
  });

  it('resolve userId ไม่เจอ (null) → delivered=false, ไม่แตะ push/credential', async () => {
    const push: LinePushClient = vi.fn(async () => ({ ok: true as const, requestId: null }));
    const resolveCredentials = vi.fn(async () => creds);
    const gateway = createLineOutboundGateway({
      resolveRoute: async () => null,
      resolveCredentials,
      push,
    });

    const res = await gateway.send(outboundMessage);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(resolveCredentials).not.toHaveBeenCalled();
  });

  it('ไม่มี credential ตั้งไว้ → send_failed (config ผิด)', async () => {
    const push: LinePushClient = vi.fn(async () => ({ ok: true as const, requestId: null }));
    const gateway = createLineOutboundGateway({
      resolveRoute: async () => 'U1',
      resolveCredentials: async () => null,
      push,
    });

    const res = await gateway.send(outboundMessage);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('send_failed');
    expect(push).not.toHaveBeenCalled();
  });

  it('push HTTP ล้ม → send_failed (message persist แล้ว—ไม่หาย)', async () => {
    const push: LinePushClient = vi.fn(async () => ({
      ok: false as const,
      status: 429,
      message: 'rate limited',
    }));
    const gateway = createLineOutboundGateway({
      resolveRoute: async () => 'U1',
      resolveCredentials: async () => creds,
      push,
    });

    const res = await gateway.send(outboundMessage);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('send_failed');
  });
});

describe('createLineHttpPushClient', () => {
  it('2xx → ok + requestId จาก header · ยิง URL/Bearer/body ถูก', async () => {
    const calls: Array<{ url: string; init: Parameters<LineFetch>[1] }> = [];
    const fakeFetch: LineFetch = async (url, init) => {
      calls.push({ url, init });
      const response: LineHttpResponse = {
        ok: true,
        status: 200,
        headers: { get: (name) => (name === 'x-line-request-id' ? 'req-xyz' : null) },
      };
      return response;
    };
    const client = createLineHttpPushClient(fakeFetch);

    const result = await client({
      accessToken: 'TOKEN',
      to: 'U1',
      messages: [{ type: 'text', text: 'hi' }],
    });

    expect(result).toEqual({ ok: true, requestId: 'req-xyz' });
    expect(calls[0]?.url).toBe('https://api.line.me/v2/bot/message/push');
    expect(calls[0]?.init.headers.authorization).toBe('Bearer TOKEN');
    expect(JSON.parse(calls[0]?.init.body ?? '{}')).toEqual({
      to: 'U1',
      messages: [{ type: 'text', text: 'hi' }],
    });
  });

  it('มี retryKey → ส่ง header x-line-retry-key (idempotency) · ไม่มี → ไม่ใส่ header', async () => {
    const seen: Array<Record<string, string>> = [];
    const fakeFetch: LineFetch = async (_url, init) => {
      seen.push(init.headers);
      return { ok: true, status: 200, headers: { get: () => null } };
    };
    const client = createLineHttpPushClient(fakeFetch);

    await client({
      accessToken: 'x',
      to: 'U1',
      messages: [{ type: 'text', text: 'hi' }],
      retryKey: 'key-1',
    });
    await client({ accessToken: 'x', to: 'U1', messages: [{ type: 'text', text: 'hi' }] });

    expect(seen[0]?.['x-line-retry-key']).toBe('key-1');
    expect(seen[1]?.['x-line-retry-key']).toBeUndefined();
  });

  it('non-2xx → ok:false + status', async () => {
    const fakeFetch: LineFetch = async () => ({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });
    const client = createLineHttpPushClient(fakeFetch);
    const result = await client({
      accessToken: 'x',
      to: 'U1',
      messages: [{ type: 'text', text: 'hi' }],
    });
    expect(result).toEqual({ ok: false, status: 401, message: 'line push HTTP 401' });
  });

  it('network error (throw) → ok:false status 0 (ไม่ throw ต่อ)', async () => {
    const fakeFetch: LineFetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const client = createLineHttpPushClient(fakeFetch);
    const result = await client({
      accessToken: 'x',
      to: 'U1',
      messages: [{ type: 'text', text: 'hi' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(0);
  });
});

describe('lineRetryKey', () => {
  it('deterministic — message.id เดิม → key เดิม (retry ใช้ค่าเดียวกัน)', () => {
    expect(lineRetryKey('msg_abc')).toBe(lineRetryKey('msg_abc'));
  });

  it('message.id ต่างกัน → key ต่างกัน', () => {
    expect(lineRetryKey('msg_1')).not.toBe(lineRetryKey('msg_2'));
  });

  it('รูปแบบเป็น UUID (8-4-4-4-12 hex, version 4)', () => {
    expect(lineRetryKey('msg_1')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
