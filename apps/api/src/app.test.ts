import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { err, ok } from '@omni/domain';
import type {
  Channel,
  ChannelRepository,
  Contact,
  Conversation,
  ConversationRepository,
  IngestInboundResult,
  InboxReadRepository,
  ManageConversation,
  Message,
} from '@omni/domain';
import { webSessionKey } from '@omni/channel-web';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import type { AppDeps } from './deps';
import type { AuthService } from './auth/service';
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
  deduped: false,
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

/** auth ปลอม: agent@demo.local/good → token "tok_valid" · authenticate("tok_valid") → ws_1/agt_1 */
const auth: AuthService = {
  login: async (email, password) =>
    email === 'agent@demo.local' && password === 'good'
      ? {
          token: 'tok_valid',
          agent: {
            id: 'agt_1',
            workspaceId: 'ws_1',
            email,
            displayName: 'ทีมงาน',
            createdAt: AT,
          },
        }
      : null,
  authenticate: (token) =>
    token === 'tok_valid' ? { workspaceId: 'ws_1', agentId: 'agt_1' } : null,
};

/** inbox read-model ปลอม — ws_1 มี 1 สาย (conv_1) + history 1 ข้อความ */
const inboxRead: InboxReadRepository = {
  listConversations: async (workspaceId) =>
    workspaceId === 'ws_1'
      ? [
          {
            conversation: cannedConversation,
            contactName: 'ลูกค้า',
            lastMessage: {
              direction: 'inbound',
              content: { type: 'text', text: 'สวัสดี' },
              createdAt: AT,
            },
          },
        ]
      : [],
  listMessages: async (workspaceId, conversationId) =>
    workspaceId === 'ws_1' && conversationId === 'conv_1' ? [cannedMessage] : [],
  getMessageById: async (workspaceId, messageId) =>
    workspaceId === 'ws_1' && messageId === 'msg_1' ? cannedMessage : null,
  getConversationListItem: async (workspaceId, conversationId) =>
    workspaceId === 'ws_1' && conversationId === 'conv_1'
      ? { conversation: cannedConversation, contactName: 'ลูกค้า', lastMessage: null }
      : null,
};

/** conversations ปลอม — ws_1 มีทุกสายยกเว้น conv_missing (ไว้เทส 404) */
const conversationsRepo: ConversationRepository = {
  findLatestOpen: async () => null,
  findById: async (workspaceId, conversationId) =>
    workspaceId === 'ws_1' && conversationId !== 'conv_missing'
      ? { ...cannedConversation, id: conversationId, channelId: 'chn_web1' }
      : null,
  insert: async () => {},
  touch: async () => {},
  setAssignee: async () => {},
  setStatus: async () => {},
};

/** manageConversation ปลอม — ws_1 + ไม่ใช่ conv_missing = สำเร็จ (สะท้อน id/assignee/status) */
const manageConversation: ManageConversation = {
  assign: async ({ workspaceId, conversationId, agentId }) =>
    workspaceId === 'ws_1' && conversationId !== 'conv_missing'
      ? ok({ ...cannedConversation, id: conversationId, assignee: { kind: 'agent', agentId } })
      : err({ code: 'conversation_not_found', message: 'x' }),
  unassign: async ({ workspaceId, conversationId }) =>
    workspaceId === 'ws_1' && conversationId !== 'conv_missing'
      ? ok({ ...cannedConversation, id: conversationId, assignee: null })
      : err({ code: 'conversation_not_found', message: 'x' }),
  close: async ({ workspaceId, conversationId }) =>
    workspaceId === 'ws_1' && conversationId !== 'conv_missing'
      ? ok({ ...cannedConversation, id: conversationId, status: 'closed' })
      : err({ code: 'conversation_not_found', message: 'x' }),
  reopen: async ({ workspaceId, conversationId }) =>
    workspaceId === 'ws_1' && conversationId !== 'conv_missing'
      ? ok({ ...cannedConversation, id: conversationId, status: 'open' })
      : err({ code: 'conversation_not_found', message: 'x' }),
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
    agentRegistry: createConnectionRegistry(),
    inboxRead,
    conversations: conversationsRepo,
    manageConversation,
    auth,
    newSessionId: () => 'web_test_session',
    lineCredentials: async () => null,
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

describe('POST /auth/login + GET /auth/me', () => {
  it('credential ถูก → 200 + token + agent (ไม่มี passwordHash)', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'agent@demo.local', password: 'good' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      token: 'tok_valid',
      agent: { id: 'agt_1', workspaceId: 'ws_1', email: 'agent@demo.local', displayName: 'ทีมงาน' },
    });
  });

  it('credential ผิด → 401 invalid_credentials', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'agent@demo.local', password: 'bad' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_credentials' });
  });

  it('body ไม่ใช่อีเมล → 400 invalid_body', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ไม่ใช่อีเมล', password: 'x' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_body' });
  });

  it('GET /auth/me มี Bearer token ถูก → 200 + context', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer tok_valid' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ workspaceId: 'ws_1', agentId: 'agt_1' });
  });

  it('GET /auth/me ไม่มี token → 401', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /auth/me token ผิด → 401', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer tok_invalid' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('inbox routes (authed)', () => {
  const BEARER = { authorization: 'Bearer tok_valid' };

  it('GET /inbox/conversations ไม่มี token → 401', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/inbox/conversations' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /inbox/conversations authed → 200 + list (contactName + lastMessage)', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({ method: 'GET', url: '/inbox/conversations', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { conversations: unknown[] };
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0]).toMatchObject({
      id: 'conv_1',
      contactName: 'ลูกค้า',
      status: 'open',
      lastMessage: { direction: 'inbound', content: { type: 'text', text: 'สวัสดี' } },
    });
  });

  it('GET /inbox/conversations/:id/messages authed → 200 + messages (ISO date)', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'GET',
      url: '/inbox/conversations/conv_1/messages',
      headers: BEARER,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { messages: Array<{ id: string; at: string }> };
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]?.id).toBe('msg_1');
    expect(typeof body.messages[0]?.at).toBe('string');
  });

  it('GET messages: conversationId ผิดรูป → 400', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'GET',
      url: '/inbox/conversations/xxx/messages',
      headers: BEARER,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_conversation_id' });
  });

  it('POST /inbox/conversations/:id/reply authed → 200 + message + delivered', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/inbox/conversations/conv_known/reply',
      headers: BEARER,
      payload: { text: 'ทีมงานตอบครับ' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ message: { id: 'msg_out' }, delivered: true });
  });

  it('POST reply: conversation ไม่มีใน workspace → 404', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/inbox/conversations/conv_missing/reply',
      headers: BEARER,
      payload: { text: 'x' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'conversation_not_found' });
  });

  it('POST reply: ไม่มี token → 401', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/inbox/conversations/conv_known/reply',
      payload: { text: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST assign authed → 200 + assignee = agent จาก token', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/inbox/conversations/conv_1/assign',
      headers: BEARER,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      conversation: { id: 'conv_1', assignee: { kind: 'agent', agentId: 'agt_1' } },
    });
  });

  it('POST close authed → 200 + status closed', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/inbox/conversations/conv_1/close',
      headers: BEARER,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ conversation: { status: 'closed' } });
  });

  it('POST assign: conversation ไม่มี → 404', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({
      method: 'POST',
      url: '/inbox/conversations/conv_missing/assign',
      headers: BEARER,
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST assign: ไม่มี token → 401', async () => {
    app = await buildApp(makeDeps());
    const res = await app.inject({ method: 'POST', url: '/inbox/conversations/conv_1/assign' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /inbox/ws (agent realtime registration)', () => {
  it('token ถูก → register socket ใต้ workspaceId · ตัด → ถอด', async () => {
    const deps = makeDeps();
    app = await buildApp(deps);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    const client = new WebSocket(`ws://127.0.0.1:${port}/inbox/ws?token=tok_valid`);
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });

    await waitFor(() => deps.agentRegistry.size('ws_1') === 1);
    expect(deps.agentRegistry.size('ws_1')).toBe(1);

    client.close();
    await waitFor(() => deps.agentRegistry.size('ws_1') === 0);
    expect(deps.agentRegistry.size('ws_1')).toBe(0);
  });

  it('token ผิด → server ปิด socket (1008)', async () => {
    const deps = makeDeps();
    app = await buildApp(deps);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    const client = new WebSocket(`ws://127.0.0.1:${port}/inbox/ws?token=bad`);
    const closeCode = await new Promise<number>((resolve, reject) => {
      client.on('close', (code) => resolve(code));
      client.on('error', reject);
    });
    expect(closeCode).toBe(1008);
    expect(deps.agentRegistry.size('ws_1')).toBe(0);
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
