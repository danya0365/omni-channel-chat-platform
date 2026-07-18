import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { err, ok } from '@omni/domain';
import type {
  Channel,
  ChannelRepository,
  Contact,
  Conversation,
  IngestInboundResult,
  Message,
} from '@omni/domain';
import { webSessionKey } from '@omni/channel-web';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import type { AppDeps } from './deps';
import { createConnectionRegistry } from './registry';

const AT = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

const WEB_CHANNEL: Channel = {
  id: 'chn_web1',
  workspaceId: 'ws_1',
  type: 'web',
  displayName: 'Web widget',
  createdAt: AT,
};

const cannedContact: Contact = {
  id: 'ctc_1',
  workspaceId: 'ws_1',
  displayName: 'ลูกค้า',
  createdAt: AT,
};
const cannedConversation: Conversation = {
  id: 'conv_1',
  workspaceId: 'ws_1',
  contactId: 'ctc_1',
  channelId: 'chn_web1',
  status: 'open',
  assignee: null,
  createdAt: AT,
  lastMessageAt: AT,
};
const cannedMessage: Message = {
  id: 'msg_1',
  workspaceId: 'ws_1',
  conversationId: 'conv_1',
  channelId: 'chn_web1',
  direction: 'inbound',
  sender: { kind: 'contact', contactId: 'ctc_1' },
  content: { type: 'text', text: 'สวัสดี' },
  status: 'received',
  externalId: null,
  createdAt: AT,
};
const cannedIngestResult: IngestInboundResult = {
  message: cannedMessage,
  conversation: cannedConversation,
  contact: cannedContact,
  created: { contact: true, conversation: true },
};
const cannedOutbound: Message = {
  ...cannedMessage,
  id: 'msg_out',
  direction: 'outbound',
  sender: { kind: 'bot' },
  status: 'sent',
};

const channels: ChannelRepository = {
  findPublicById: async (id) => (id === WEB_CHANNEL.id ? WEB_CHANNEL : null),
};

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    channels,
    ingest: async () => ok(cannedIngestResult),
    // conv_known → ส่งได้ · อื่น → not found (จำลอง sendOutbound domain service)
    sendOutbound: async (cmd) =>
      cmd.conversationId === 'conv_known'
        ? ok({ message: cannedOutbound, delivered: true, externalId: null })
        : err({ code: 'conversation_not_found', message: 'x' }),
    registry: createConnectionRegistry(),
    newSessionId: () => 'web_test_session',
    ...overrides,
  };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** poll จนเงื่อนไขจริง หรือ timeout (กัน race ของ WS upgrade) */
async function waitFor(cond: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('GET /healthz', () => {
  it('ตอบ 200 + { status: ok }', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /channels/web/:channelId/sessions', () => {
  it('channel มีจริง → 200 + sessionId', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({ method: 'POST', url: '/channels/web/chn_web1/sessions' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sessionId: 'web_test_session', channelId: 'chn_web1' });
  });

  it('channel ไม่มี → 404', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({ method: 'POST', url: '/channels/web/chn_ไม่มี/sessions' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'channel_not_found' });
  });
});

describe('POST /channels/web/:channelId/messages', () => {
  it('body ถูก → 200 + conversationId/messageId จาก ingest result', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/channels/web/chn_web1/messages',
      payload: { sessionId: 'web_test_session', text: 'สวัสดี' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ conversationId: 'conv_1', messageId: 'msg_1' });
  });

  it('body ไม่มี text → 400 invalid_body', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/channels/web/chn_web1/messages',
      payload: { sessionId: 'web_test_session' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_body' });
  });

  it('ingest คืน err → map เป็น 400 + error code', async () => {
    app = await buildApp(
      makeDeps({ ingest: async () => err({ code: 'invalid_command', message: 'bad' }) }),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/channels/web/chn_web1/messages',
      payload: { sessionId: 's', text: 'x' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_command' });
  });

  it('channel ไม่มี → 404', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/channels/web/chn_ไม่มี/messages',
      payload: { sessionId: 's', text: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /channels/web/:channelId/reply', () => {
  it('conversation มีจริง → 200 + delivered', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/channels/web/chn_web1/reply',
      payload: { conversationId: 'conv_known', text: 'ตอบกลับ' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ messageId: 'msg_out', delivered: true });
  });

  it('conversation ไม่มี → 404 conversation_not_found', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/channels/web/chn_web1/reply',
      payload: { conversationId: 'conv_ไม่มี', text: 'x' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'conversation_not_found' });
  });

  it('body conversationId ผิดรูป (ไม่ใช่ conv_) → 400 invalid_body', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/channels/web/chn_web1/reply',
      payload: { conversationId: 'xxx', text: 'x' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_body' });
  });
});

describe('GET /channels/web/:channelId/ws (registration)', () => {
  it('เชื่อม WS ด้วย sessionId → ลงทะเบียน socket ใน registry, ตัด → ถอดออก', async () => {
    const deps = makeDeps();
    app = await buildApp(deps);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    const key = webSessionKey('ws_1', 'chn_web1', 's1');
    const client = new WebSocket(`ws://127.0.0.1:${port}/channels/web/chn_web1/ws?sessionId=s1`);
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });

    await waitFor(() => deps.registry.size(key) === 1);
    expect(deps.registry.size(key)).toBe(1);

    client.close();
    await waitFor(() => deps.registry.size(key) === 0);
    expect(deps.registry.size(key)).toBe(0);
  });
});
