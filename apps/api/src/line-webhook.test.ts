import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ok } from '@omni/domain';
import type {
  Channel,
  ChannelRepository,
  Contact,
  Conversation,
  ConversationRepository,
  IngestInboundCommand,
  IngestInboundResult,
  InboxReadRepository,
  ManageConversation,
  Message,
} from '@omni/domain';
import type { LineCredentialResolver } from '@omni/channel-line';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import type { AppDeps } from './deps';
import type { AuthService } from './auth/service';
import { createConnectionRegistry } from './registry';

const AT = new Date(Date.UTC(2026, 0, 1));
const CHANNEL_SECRET = 'line-secret-สมมติ-1234';

const LINE_CHANNEL: Channel = {
  id: 'chn_line1',
  workspaceId: 'ws_1',
  type: 'line',
  displayName: 'LINE OA',
  createdAt: AT,
};
/** line channel ที่ยังไม่ได้ตั้ง credential (ไว้เทส channel_not_configured) */
const LINE_CHANNEL_NOCONF: Channel = { ...LINE_CHANNEL, id: 'chn_line_noconf' };
const WEB_CHANNEL: Channel = { ...LINE_CHANNEL, id: 'chn_web1', type: 'web', displayName: 'Web' };

const cannedIngestResult: IngestInboundResult = {
  message: {
    id: 'msg_1',
    workspaceId: 'ws_1',
    conversationId: 'conv_1',
    channelId: 'chn_line1',
    direction: 'inbound',
    sender: { kind: 'contact', contactId: 'ctc_1' },
    content: { type: 'text', text: 'สวัสดีครับ' },
    status: 'received',
    externalId: '14353798921116',
    createdAt: AT,
  } satisfies Message,
  conversation: {
    id: 'conv_1',
    workspaceId: 'ws_1',
    contactId: 'ctc_1',
    channelId: 'chn_line1',
    status: 'open',
    assignee: null,
    createdAt: AT,
    lastMessageAt: AT,
  } satisfies Conversation,
  contact: { id: 'ctc_1', workspaceId: 'ws_1', displayName: null, createdAt: AT } satisfies Contact,
  created: { contact: true, conversation: true },
  deduped: false,
};

const channels: ChannelRepository = {
  findPublicById: async (id) =>
    id === LINE_CHANNEL.id
      ? LINE_CHANNEL
      : id === LINE_CHANNEL_NOCONF.id
        ? LINE_CHANNEL_NOCONF
        : id === WEB_CHANNEL.id
          ? WEB_CHANNEL
          : null,
};

const lineCredentials: LineCredentialResolver = async (_ws, channelId) =>
  channelId === LINE_CHANNEL.id
    ? { channelAccessToken: 'tok', channelSecret: CHANNEL_SECRET }
    : null;

const noopConversations: ConversationRepository = {
  findLatestOpen: async () => null,
  findById: async () => null,
  insert: async () => {},
  touch: async () => {},
  setAssignee: async () => {},
  setStatus: async () => {},
};
const noopInboxRead: InboxReadRepository = {
  listConversations: async () => [],
  listMessages: async () => [],
  getMessageById: async () => null,
  getConversationListItem: async () => null,
};
const noopManage = {} as ManageConversation;
const noopAuth = {} as AuthService;

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    channels,
    ingest: vi.fn(async () => ok(cannedIngestResult)),
    sendOutbound: async () =>
      ok({ message: cannedIngestResult.message, delivered: true, externalId: null }),
    registry: createConnectionRegistry(),
    agentRegistry: createConnectionRegistry(),
    inboxRead: noopInboxRead,
    conversations: noopConversations,
    manageConversation: noopManage,
    auth: noopAuth,
    newSessionId: () => 'sess',
    lineCredentials,
    ...overrides,
  };
}

/** fixture: LINE webhook body (โครงตาม LINE Messaging API docs) */
function webhookBody(text = 'สวัสดีครับ', userId = 'U80696558e1aa831') {
  return JSON.stringify({
    destination: 'U0123456789abcdef',
    events: [
      {
        type: 'message',
        mode: 'active',
        timestamp: 1625665242211,
        source: { type: 'user', userId },
        replyToken: '757913772c4646b784d4b7ce46d12671',
        message: { type: 'text', id: '14353798921116', text },
      },
    ],
  });
}

/** เซ็น raw body เหมือน LINE (HMAC-SHA256 → base64) */
function sign(rawBody: string, secret = CHANNEL_SECRET): string {
  return createHmac('sha256', secret).update(rawBody).digest('base64');
}

async function postWebhook(
  app: FastifyInstance,
  channelId: string,
  rawBody: string,
  signature: string | undefined,
) {
  return app.inject({
    method: 'POST',
    url: `/channels/line/${channelId}/webhook`,
    headers: {
      'content-type': 'application/json',
      ...(signature ? { 'x-line-signature': signature } : {}),
    },
    payload: rawBody,
  });
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('POST /channels/line/:channelId/webhook', () => {
  it('signature ถูก + text message → 200 · ingest ถูกเรียกด้วย command ที่ map แล้ว', async () => {
    const ingest = vi.fn(async (_command: IngestInboundCommand) => ok(cannedIngestResult));
    const deps = makeDeps({ ingest });
    app = await buildApp(deps);
    const body = webhookBody();

    const res = await postWebhook(app, 'chn_line1', body, sign(body));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(ingest).toHaveBeenCalledTimes(1);
    const command = ingest.mock.calls[0]?.[0];
    expect(command).toMatchObject({
      workspaceId: 'ws_1',
      channelId: 'chn_line1',
      externalId: 'U80696558e1aa831',
      content: { type: 'text', text: 'สวัสดีครับ' },
      externalMessageId: '14353798921116',
    });
  });

  it('signature ผิด → 401 invalid_signature · ไม่ ingest', async () => {
    const ingest = vi.fn(async () => ok(cannedIngestResult));
    app = await buildApp(makeDeps({ ingest }));
    const body = webhookBody();

    const res = await postWebhook(app, 'chn_line1', body, sign(body, 'secret-ผิด'));

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_signature' });
    expect(ingest).not.toHaveBeenCalled();
  });

  it('ไม่มี header x-line-signature → 401', async () => {
    app = await buildApp(makeDeps());
    const body = webhookBody();
    const res = await postWebhook(app, 'chn_line1', body, undefined);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_signature' });
  });

  it('channel ไม่ใช่ line (เป็น web) → 404 channel_not_found', async () => {
    app = await buildApp(makeDeps());
    const body = webhookBody();
    const res = await postWebhook(app, 'chn_web1', body, sign(body));
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'channel_not_found' });
  });

  it('channelId ไม่มีจริง → 404', async () => {
    app = await buildApp(makeDeps());
    const body = webhookBody();
    const res = await postWebhook(app, 'chn_ไม่มี', body, sign(body));
    expect(res.statusCode).toBe(404);
  });

  it('line channel ที่ยังไม่ตั้ง credential → 401 channel_not_configured', async () => {
    app = await buildApp(makeDeps());
    const body = webhookBody();
    const res = await postWebhook(app, 'chn_line_noconf', body, sign(body));
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'channel_not_configured' });
  });

  it('verify request (body ว่าง) + signature ถูก → 200 · ไม่ ingest', async () => {
    const ingest = vi.fn(async () => ok(cannedIngestResult));
    app = await buildApp(makeDeps({ ingest }));
    const empty = '';
    const res = await postWebhook(app, 'chn_line1', empty, sign(empty));
    expect(res.statusCode).toBe(200);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('non-text event (sticker) + signature ถูก → 200 · ไม่ ingest (ข้าม)', async () => {
    const ingest = vi.fn(async () => ok(cannedIngestResult));
    app = await buildApp(makeDeps({ ingest }));
    const body = JSON.stringify({
      events: [
        {
          type: 'message',
          source: { type: 'user', userId: 'U1' },
          message: { type: 'sticker', id: '1', packageId: '1', stickerId: '1' },
        },
      ],
    });
    const res = await postWebhook(app, 'chn_line1', body, sign(body));
    expect(res.statusCode).toBe(200);
    expect(ingest).not.toHaveBeenCalled();
  });
});
