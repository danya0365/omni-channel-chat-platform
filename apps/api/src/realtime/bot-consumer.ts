import { applyBotRules } from '@omni/domain';
import type {
  Assignee,
  BotRule,
  ChannelId,
  Conversation,
  ConversationId,
  ConversationRef,
  ManageConversation,
  Message,
  MessageContent,
  MessageId,
  SendOutboundMessage,
  WorkspaceId,
} from '@omni/domain';
import type { OutboxRow } from '@omni/db';

/**
 * ข้อความแจ้งลูกค้าตอน bot โอนหา human (escalate) — static, ไม่มี PII
 * (Phase 6+ ค่อยทำ per-workspace customize)
 */
const ESCALATE_NOTICE: MessageContent = {
  type: 'text',
  text: 'ขอบคุณสำหรับข้อความครับ 🙏 เดี๋ยวทีมงานมาช่วยดูแลต่อให้นะครับ',
};

export interface BotConsumerDeps {
  /** claim outbox batch ของ subscriber 'bot' (cursor bot เอง — ไม่แตะ processed_at ของ agent WS) */
  claimBatch(limit: number): Promise<OutboxRow[]>;
  /** bot เปิดใช้ใน workspace นี้ไหม (ไม่มี config = ปิด) */
  isBotEnabled(workspaceId: WorkspaceId): Promise<boolean>;
  /** rules ที่ enabled ของ workspace+channel (รวม global) เรียง priority */
  listRules(workspaceId: WorkspaceId, channelId: ChannelId): Promise<BotRule[]>;
  /** อ่าน conversation (assignee) — ใช้ตัดสิน ownership */
  getConversation(
    workspaceId: WorkspaceId,
    conversationId: ConversationId,
  ): Promise<Conversation | null>;
  /** อ่าน message inbound (ข้อความลูกค้า) เพื่อ match rules */
  getMessage(workspaceId: WorkspaceId, messageId: MessageId): Promise<Message | null>;
  /** ส่ง reply/แจ้ง escalate (sender bot) */
  sendOutbound: SendOutboundMessage;
  /** ให้ bot รับสาย (assignBot) / คืนสายเข้า queue (escalate) */
  manage: Pick<ManageConversation, 'assignBot' | 'escalate'>;
  batchSize?: number;
}

const DEFAULT_BATCH = 50;

/** ข้อมูล inbound event ที่ parse + validate แล้ว (payload → typed) */
interface InboundRef {
  ws: WorkspaceId;
  channelId: ChannelId;
  conv: ConversationId;
  messageId: MessageId;
  /** สายนี้เพิ่งถูกเปิดในรอบนี้ไหม (แยกสายใหม่ออกจากสาย escalate ค้าง) */
  isNew: boolean;
}

/** parse payload ของ inbound event → typed ref (คืน null ถ้า field ไม่ครบ/ผิดชนิด) */
function parseInbound(payload: Record<string, unknown>): InboundRef | null {
  const { workspaceId, channelId, conversationId, messageId } = payload;
  if (
    typeof workspaceId !== 'string' ||
    typeof channelId !== 'string' ||
    typeof conversationId !== 'string' ||
    typeof messageId !== 'string'
  ) {
    return null;
  }
  return {
    ws: workspaceId as WorkspaceId,
    channelId: channelId as ChannelId,
    conv: conversationId as ConversationId,
    messageId: messageId as MessageId,
    isNew: payload.conversationCreated === true,
  };
}

/** bot ควรทำอะไรกับ inbound นี้ (จาก assignee ปัจจุบัน + เป็นสายใหม่ไหม) */
type Ownership = 'skip' | 'own' | 'handle';
function ownershipFor(assignee: Assignee | null, isNew: boolean): Ownership {
  if (assignee?.kind === 'bot') return 'handle'; // bot ดูแลอยู่แล้ว → ตอบต่อ
  if (assignee?.kind === 'agent') return 'skip'; // human จับแล้ว → เงียบถาวร
  return isNew ? 'own' : 'skip'; // null: สายใหม่ → รับ · สาย escalate ค้าง → เงียบ (รอ human)
}

function textOf(content: MessageContent): string | null {
  return content.type === 'text' ? content.text : null;
}

/**
 * Bot consumer (Phase 5, rule-only) — `drainBot()`: claim outbox batch (cursor 'bot') →
 * สำหรับแต่ละ `inbound_message.received`: เช็ค bot เปิด + ownership → match rules →
 *   reply (canned) · escalate (คืน queue + แจ้งลูกค้า) · no_match → escalate (5B ค่อยเสียบ AI ตรงนี้)
 *
 * decoupled จาก request path (LINE/web ได้ 200 เร็ว) · cursor แยก = ไม่แตะ agent WS consumer เดิม
 * ประมวลผล **นอก claim tx** (sendOutbound/manage เปิด tx เอง) — bot logic = network ห้ามถือ tx ค้าง
 */
export function createBotConsumer(deps: BotConsumerDeps) {
  const batchSize = deps.batchSize ?? DEFAULT_BATCH;

  const send = (ref: InboundRef, content: MessageContent): ReturnType<SendOutboundMessage> =>
    deps.sendOutbound({
      workspaceId: ref.ws,
      channelId: ref.channelId,
      conversationId: ref.conv,
      content,
      sender: { kind: 'bot' },
    });

  const conversationRef = (ref: InboundRef): ConversationRef => ({
    workspaceId: ref.ws,
    conversationId: ref.conv,
  });

  /** ตอบ canned — สายใหม่ (own) ให้ bot รับก่อน แล้วค่อยส่ง */
  async function doReply(ref: InboundRef, ownership: Ownership, content: MessageContent) {
    if (ownership === 'own') await deps.manage.assignBot(conversationRef(ref));
    await send(ref, content);
  }

  /** โอนหา human — คืนสายเข้า queue (assignee=null) ก่อน แล้วแจ้งลูกค้า (fail-safe เข้าหา human) */
  async function doEscalate(ref: InboundRef) {
    await deps.manage.escalate(conversationRef(ref));
    await send(ref, ESCALATE_NOTICE);
  }

  /** ประมวลผล inbound หนึ่ง event → true ถ้า bot ลงมือ (reply/escalate) · false ถ้าเงียบ/ข้าม */
  async function handleInbound(payload: Record<string, unknown>): Promise<boolean> {
    const ref = parseInbound(payload);
    if (!ref) return false;
    if (!(await deps.isBotEnabled(ref.ws))) return false;

    const conversation = await deps.getConversation(ref.ws, ref.conv);
    if (!conversation) return false;

    const ownership = ownershipFor(conversation.assignee, ref.isNew);
    if (ownership === 'skip') return false;

    const message = await deps.getMessage(ref.ws, ref.messageId);
    const text = message && textOf(message.content);
    if (text == null) return false; // ไม่ใช่ text (MVP bot ตอบ text อย่างเดียว) → ปล่อยให้ human ดู

    const decision = applyBotRules(text, await deps.listRules(ref.ws, ref.channelId));
    if (decision.kind === 'reply') {
      await doReply(ref, ownership, decision.content);
      return true;
    }
    // escalate (keyword ขอคน) หรือ no_match (rule ไม่เจอ — 5B ค่อยแทรก AI ก่อนถึงตรงนี้)
    await doEscalate(ref);
    return true;
  }

  return async function drainBot(): Promise<number> {
    const rows = await deps.claimBatch(batchSize);
    let handled = 0;
    for (const row of rows) {
      if (row.type !== 'inbound_message.received') continue; // bot สนใจแค่ inbound (กัน loop reply)
      if (await handleInbound(row.payload)) handled += 1;
    }
    return handled;
  };
}
