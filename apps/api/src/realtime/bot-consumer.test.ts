import { describe, expect, it } from 'vitest';
import { err, ok } from '@omni/domain';
import type {
  BotAiDecision,
  BotAiReplier,
  BotRule,
  Conversation,
  ConversationRef,
  Message,
  MessageContent,
  SendOutboundCommand,
} from '@omni/domain';
import type { OutboxRow } from '@omni/db';
import { createBotConsumer } from './bot-consumer';

const AT = new Date(Date.UTC(2026, 0, 1));
const WS = 'ws_1';
const CHN = 'chn_web1';
const CONV = 'conv_1';
const MSG = 'msg_1';

const conversation = (assignee: Conversation['assignee']): Conversation => ({
  id: CONV,
  workspaceId: WS,
  contactId: 'ctc_1',
  channelId: CHN,
  status: 'open',
  assignee,
  createdAt: AT,
  lastMessageAt: AT,
});

const inboundMessage = (text: string): Message => ({
  id: MSG,
  workspaceId: WS,
  conversationId: CONV,
  channelId: CHN,
  direction: 'inbound',
  sender: { kind: 'contact', contactId: 'ctc_1' },
  content: { type: 'text', text },
  status: 'received',
  externalId: null,
  createdAt: AT,
});

const rule = (pattern: string, action: BotRule['action'], priority = 10): BotRule => ({
  id: 'botr_1',
  workspaceId: WS,
  channelId: null,
  matchType: 'contains',
  pattern,
  action,
  enabled: true,
  priority,
  createdAt: AT,
});

const replyRule = (pattern: string, text: string, priority?: number): BotRule =>
  rule(pattern, { kind: 'reply', content: { type: 'text', text } }, priority);
const escalateRule = (pattern: string, priority?: number): BotRule =>
  rule(pattern, { kind: 'escalate' }, priority);

const inboundRow = (payload: Record<string, unknown> = {}): OutboxRow => ({
  id: 'obx_1',
  type: 'inbound_message.received',
  payload: {
    workspaceId: WS,
    channelId: CHN,
    conversationId: CONV,
    messageId: MSG,
    conversationCreated: true,
    ...payload,
  },
  occurredAt: AT,
});

interface Recorder {
  assignBot: ConversationRef[];
  escalate: ConversationRef[];
  sent: SendOutboundCommand[];
}

function setup(opts: {
  rows?: OutboxRow[];
  botEnabled?: boolean;
  aiEnabled?: boolean;
  conversation?: Conversation | null;
  message?: Message | null;
  rules?: BotRule[];
  aiReply?: BotAiReplier;
}) {
  const rec: Recorder = { assignBot: [], escalate: [], sent: [] };
  const conv = opts.conversation === undefined ? conversation(null) : opts.conversation;
  const botEnabled = opts.botEnabled ?? true;
  const drainBot = createBotConsumer({
    claimBatch: async () => opts.rows ?? [inboundRow()],
    getBotConfig: async () =>
      botEnabled ? { workspaceId: WS, botEnabled, aiEnabled: opts.aiEnabled ?? false } : null,
    listRules: async () => opts.rules ?? [],
    getConversation: async () => conv,
    getMessage: async () => (opts.message === undefined ? inboundMessage('สวัสดี') : opts.message),
    sendOutbound: async (cmd) => {
      rec.sent.push(cmd);
      const message: Message = {
        ...inboundMessage('x'),
        id: 'msg_out',
        direction: 'outbound',
        sender: { kind: 'bot' },
        content: cmd.content as MessageContent,
        status: 'sent',
      };
      return ok({ message, delivered: false, externalId: null });
    },
    manage: {
      assignBot: async (ref) => {
        rec.assignBot.push(ref);
        return ok(conversation({ kind: 'bot' }));
      },
      escalate: async (ref) => {
        rec.escalate.push(ref);
        return ok(conversation(null));
      },
    },
    aiReply: opts.aiReply,
  });
  return { drainBot, rec };
}

describe('createBotConsumer (rule-only · Phase 5)', () => {
  it('bot ปิดใน workspace → เงียบ (ไม่ตอบ/ไม่ assign)', async () => {
    const { drainBot, rec } = setup({ botEnabled: false, rules: [replyRule('สวัสดี', 'hi')] });
    expect(await drainBot()).toBe(0);
    expect(rec.sent).toHaveLength(0);
    expect(rec.assignBot).toHaveLength(0);
  });

  it('สายใหม่ (assignee=null, created) + rule reply match → รับสาย (assignBot) แล้วตอบ canned', async () => {
    const { drainBot, rec } = setup({
      conversation: conversation(null),
      message: inboundMessage('สวัสดีครับ'),
      rules: [replyRule('สวัสดี', 'สวัสดีครับ ยินดีต้อนรับ')],
    });
    expect(await drainBot()).toBe(1);
    expect(rec.assignBot).toEqual([{ workspaceId: WS, conversationId: CONV }]);
    expect(rec.sent).toHaveLength(1);
    expect(rec.sent[0]).toMatchObject({
      conversationId: CONV,
      channelId: CHN,
      sender: { kind: 'bot' },
      content: { type: 'text', text: 'สวัสดีครับ ยินดีต้อนรับ' },
    });
    expect(rec.escalate).toHaveLength(0);
  });

  it('assignee = agent → เงียบ (คนดูแลแล้ว)', async () => {
    const { drainBot, rec } = setup({
      conversation: conversation({ kind: 'agent', agentId: 'agt_1' }),
      rules: [replyRule('สวัสดี', 'hi')],
    });
    expect(await drainBot()).toBe(0);
    expect(rec.sent).toHaveLength(0);
    expect(rec.assignBot).toHaveLength(0);
    expect(rec.escalate).toHaveLength(0);
  });

  it('assignee = null แต่ไม่ใช่สายใหม่ (escalate ค้าง) → เงียบ (รอ human · ไม่ re-own)', async () => {
    const { drainBot, rec } = setup({
      rows: [inboundRow({ conversationCreated: false })],
      conversation: conversation(null),
      rules: [escalateRule('อะไรก็ได้')],
      message: inboundMessage('เร็วๆนะ'),
    });
    expect(await drainBot()).toBe(0);
    expect(rec.sent).toHaveLength(0);
    expect(rec.assignBot).toHaveLength(0);
    expect(rec.escalate).toHaveLength(0);
  });

  it('assignee = bot + rule reply → ตอบต่อ (ไม่ assignBot ซ้ำ)', async () => {
    const { drainBot, rec } = setup({
      rows: [inboundRow({ conversationCreated: false })],
      conversation: conversation({ kind: 'bot' }),
      message: inboundMessage('ราคาเท่าไร'),
      rules: [replyRule('ราคา', 'ดูราคาที่เว็บครับ')],
    });
    expect(await drainBot()).toBe(1);
    expect(rec.assignBot).toHaveLength(0);
    expect(rec.sent[0]).toMatchObject({ content: { type: 'text', text: 'ดูราคาที่เว็บครับ' } });
  });

  it('assignee = bot + keyword escalate → คืน queue (escalate) + แจ้งลูกค้า', async () => {
    const { drainBot, rec } = setup({
      rows: [inboundRow({ conversationCreated: false })],
      conversation: conversation({ kind: 'bot' }),
      message: inboundMessage('ขอคุยกับแอดมินหน่อย'),
      rules: [escalateRule('แอดมิน', 5), replyRule('สวัสดี', 'hi')],
    });
    expect(await drainBot()).toBe(1);
    expect(rec.escalate).toEqual([{ workspaceId: WS, conversationId: CONV }]);
    expect(rec.assignBot).toHaveLength(0);
    expect(rec.sent).toHaveLength(1);
    expect(rec.sent[0]?.content).toMatchObject({ type: 'text' }); // notice ส่งให้ลูกค้า
  });

  it('สายใหม่ + no_match (ไม่เจอ rule) → escalate + แจ้งลูกค้า (ไม่ assignBot — 3a ยังไม่มี AI)', async () => {
    const { drainBot, rec } = setup({
      conversation: conversation(null),
      message: inboundMessage('อยากได้ใบเสนอราคาโครงการ'),
      rules: [replyRule('สวัสดี', 'hi')], // ไม่ match
    });
    expect(await drainBot()).toBe(1);
    expect(rec.escalate).toEqual([{ workspaceId: WS, conversationId: CONV }]);
    expect(rec.assignBot).toHaveLength(0); // escalate branch ไม่ own (กัน assignee flap null→bot→null)
    expect(rec.sent).toHaveLength(1);
  });

  it('event ที่ไม่ใช่ inbound_message.received → ข้าม', async () => {
    const { drainBot, rec } = setup({
      rows: [
        {
          id: 'obx_2',
          type: 'outbound_message.sent',
          payload: { workspaceId: WS },
          occurredAt: AT,
        },
      ],
    });
    expect(await drainBot()).toBe(0);
    expect(rec.sent).toHaveLength(0);
  });

  it('message ไม่ใช่ text (MVP) → เงียบ (ปล่อย human)', async () => {
    const nonText = {
      ...inboundMessage('x'),
      content: { type: 'image' } as unknown as MessageContent,
    };
    const { drainBot, rec } = setup({
      conversation: conversation({ kind: 'bot' }),
      message: nonText,
      rules: [replyRule('x', 'hi')],
    });
    expect(await drainBot()).toBe(0);
    expect(rec.sent).toHaveLength(0);
  });

  // ── Phase 5B: AI fallback (rule no_match + aiEnabled) ──
  const aiReplier = (decision: BotAiDecision | 'fail'): BotAiReplier => ({
    reply: async () =>
      decision === 'fail' ? err({ code: 'ai_failed', message: 'x' }) : ok(decision),
  });

  it('สายใหม่ + no_match + aiEnabled + AI ตอบได้ → รับสาย (assignBot) แล้วตอบข้อความ AI', async () => {
    const { drainBot, rec } = setup({
      aiEnabled: true,
      conversation: conversation(null),
      message: inboundMessage('ร้านเปิดกี่โมง'),
      rules: [replyRule('สวัสดี', 'hi')], // ไม่ match
      aiReply: aiReplier({ kind: 'reply', text: 'เปิด 9 โมงถึง 6 โมงเย็นครับ' }),
    });
    expect(await drainBot()).toBe(1);
    expect(rec.assignBot).toEqual([{ workspaceId: WS, conversationId: CONV }]);
    expect(rec.sent[0]).toMatchObject({
      content: { type: 'text', text: 'เปิด 9 โมงถึง 6 โมงเย็นครับ' },
    });
    expect(rec.escalate).toHaveLength(0);
  });

  it('no_match + aiEnabled + AI ยอมแพ้ (escalate) → escalate + notice', async () => {
    const { drainBot, rec } = setup({
      rows: [inboundRow({ conversationCreated: false })],
      aiEnabled: true,
      conversation: conversation({ kind: 'bot' }),
      message: inboundMessage('ขอคืนเงินออเดอร์ 123'),
      rules: [],
      aiReply: aiReplier({ kind: 'escalate' }),
    });
    expect(await drainBot()).toBe(1);
    expect(rec.escalate).toEqual([{ workspaceId: WS, conversationId: CONV }]);
    expect(rec.sent).toHaveLength(1);
  });

  it('no_match + aiEnabled + AI ล้ม (err) → escalate (fail-safe)', async () => {
    const { drainBot, rec } = setup({
      rows: [inboundRow({ conversationCreated: false })],
      aiEnabled: true,
      conversation: conversation({ kind: 'bot' }),
      message: inboundMessage('อะไรสักอย่าง'),
      rules: [],
      aiReply: aiReplier('fail'),
    });
    expect(await drainBot()).toBe(1);
    expect(rec.escalate).toHaveLength(1);
    expect(rec.sent).toHaveLength(1);
  });

  it('no_match + aiEnabled แต่ไม่ inject aiReply → escalate (ไม่มี AI ให้ถาม)', async () => {
    const { drainBot, rec } = setup({
      aiEnabled: true,
      conversation: conversation({ kind: 'bot' }),
      message: inboundMessage('อะไรสักอย่าง'),
      rules: [],
      // ไม่ส่ง aiReply
    });
    expect(await drainBot()).toBe(1);
    expect(rec.escalate).toHaveLength(1);
  });

  it('no_match + aiDisabled → escalate ทันที (ไม่เรียก AI)', async () => {
    let called = false;
    const spyAi: BotAiReplier = {
      reply: async () => {
        called = true;
        return ok({ kind: 'reply', text: 'ไม่ควรถูกเรียก' });
      },
    };
    const { drainBot, rec } = setup({
      aiEnabled: false,
      conversation: conversation({ kind: 'bot' }),
      message: inboundMessage('อะไรสักอย่าง'),
      rules: [],
      aiReply: spyAi,
    });
    expect(await drainBot()).toBe(1);
    expect(called).toBe(false); // aiDisabled → ไม่แตะ AI (ประหยัด cost)
    expect(rec.escalate).toHaveLength(1);
  });
});
