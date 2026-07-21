import { z } from 'zod';
import { idSchema } from './ids';
import type {
  WorkspaceId,
  ChannelId,
  ContactId,
  ConversationId,
  MessageId,
  AgentId,
  BotRuleId,
} from './ids';
import type { Result } from './result';
import type { Agent } from './schema/agent';
import type { Channel } from './schema/channel';
import type { Contact, ContactIdentity } from './schema/contact';
import type { Assignee, Conversation, ConversationStatus } from './schema/conversation';
import type { DeliveryStatus, Message, MessageContent, MessageDirection } from './schema/message';
import type { BotRule } from './schema/bot-rule';
import type { WorkspaceBotConfig } from './schema/workspace-bot-config';
import type { WorkspaceEntitlements } from './schema/workspace-entitlements';

/**
 * ChannelRepository — resolve channel จาก id
 *
 * ⚠️ ข้อยกเว้น multi-tenant: `findPublicById` **ไม่รับ workspaceId** เพราะเป็น "จุดเข้า" ของ
 * inbound จากช่องทาง — client (widget) รู้แค่ `channelId` (public identifier ใน URL) ยังไม่รู้ว่า
 * อยู่ workspace ไหน. method นี้แหละที่ **สถาปนา workspace context** จาก channelId (channel ผูก 1 workspace).
 * หลังจากได้ channel แล้ว โค้ดต่อจากนี้ต้อง scope ด้วย `channel.workspaceId` เสมอ.
 */
export interface ChannelRepository {
  findPublicById(channelId: ChannelId): Promise<Channel | null>;
}

/**
 * Repository ports — adapter (@omni/db) จะ implement
 *
 * กฎ multi-tenant: ทุก method รับ `workspaceId` เป็น param บังคับ + ทุก query scope ด้วย workspace เสมอ
 * (ลืม = data leak ข้าม tenant) · insert รับ entity ที่ service ประกอบเสร็จ (id/เวลา generate ใน service)
 * adapter แค่ persist ไม่คิด business
 * ⚠️ atomicity ของ multi-insert (contact+identity) เป็นหน้าที่ adapter ครอบด้วย transaction
 */
export interface ContactRepository {
  /** หา contact + identity จาก key ช่องทาง (workspaceId, channelId, externalId) — null ถ้ายังไม่เคยเจอ */
  findByChannelIdentity(
    workspaceId: WorkspaceId,
    channelId: ChannelId,
    externalId: string,
  ): Promise<{ contact: Contact; identity: ContactIdentity } | null>;

  /** สร้าง contact ใหม่พร้อม identity แรก (atomic — adapter ครอบ transaction) */
  insertContactWithIdentity(
    workspaceId: WorkspaceId,
    contact: Contact,
    identity: ContactIdentity,
  ): Promise<void>;

  /** อัปเดตชื่อ contact (เช่น backfill จาก LINE profile API หลังสร้าง) — scope workspace */
  updateDisplayName(
    workspaceId: WorkspaceId,
    contactId: ContactId,
    displayName: string,
  ): Promise<void>;
}

export interface ConversationRepository {
  /** conversation ที่ยัง open ล่าสุดของ contact บนช่องทางนี้ — null ถ้าไม่มี (ต้องเปิดใหม่) */
  findLatestOpen(
    workspaceId: WorkspaceId,
    contactId: ContactId,
    channelId: ChannelId,
  ): Promise<Conversation | null>;

  /** หา conversation จาก id (scope workspace) — null ถ้าไม่มี · ใช้ตอน outbound เช็คว่าสายมีจริง */
  findById(workspaceId: WorkspaceId, conversationId: ConversationId): Promise<Conversation | null>;

  insert(workspaceId: WorkspaceId, conversation: Conversation): Promise<void>;

  /** อัปเดต lastMessageAt (เด้ง conversation ขึ้นบนสุดใน inbox) */
  touch(
    workspaceId: WorkspaceId,
    conversationId: ConversationId,
    lastMessageAt: Date,
  ): Promise<void>;

  /** ตั้ง/ถอด ผู้รับผิดชอบ (Phase 4 routing) — null = unassign */
  setAssignee(
    workspaceId: WorkspaceId,
    conversationId: ConversationId,
    assignee: Assignee | null,
  ): Promise<void>;

  /** เปลี่ยนสถานะสาย (open/closed) */
  setStatus(
    workspaceId: WorkspaceId,
    conversationId: ConversationId,
    status: ConversationStatus,
  ): Promise<void>;
}

export interface MessageRepository {
  /**
   * persist message · คืน `inserted: false` ถ้าชน unique `external_id` (= webhook redelivery ซ้ำ)
   * → caller (ingest) ข้าม publish/touch ให้ idempotent · `external_id = null` (web/outbound) ไม่ dedup
   */
  insert(workspaceId: WorkspaceId, message: Message): Promise<{ inserted: boolean }>;

  /**
   * อัปเดตสถานะ delivery ของ message (เช่น outbound deliver ล้ม → 'failed')
   * เรียก **นอก tx** หลัง persist — deliver เป็น network boundary ไม่ควรถือ DB tx ค้าง
   */
  updateStatus(
    workspaceId: WorkspaceId,
    messageId: MessageId,
    status: DeliveryStatus,
  ): Promise<void>;
}

/**
 * AgentRepository — resolve agent (ทีมงาน) · Phase 3 auth + inbox
 *
 * ⚠️ `findCredentialByEmail` เป็นข้อยกเว้น multi-tenant (คล้าย `ChannelRepository.findPublicById`):
 * จุดเข้า login ยังไม่รู้ว่า agent อยู่ workspace ไหน — resolve จาก email แล้ว **สถาปนา workspace context**
 * จาก `agent.workspaceId` (MVP: email unique ทั้งระบบ · ถ้าวันหลัง email ซ้ำข้าม workspace ต้องมี workspace selector)
 * คืน `passwordHash` ให้ auth layer (apps/api) verify — domain ไม่ hash/verify เอง (เป็น infra)
 */
export interface AgentRepository {
  findById(workspaceId: WorkspaceId, agentId: AgentId): Promise<Agent | null>;
  findCredentialByEmail(email: string): Promise<{ agent: Agent; passwordHash: string } | null>;
}

/**
 * BotRuleRepository — โหลด bot rules ที่ enabled สำหรับช่องทางหนึ่ง (Phase 5 automation)
 * คืนรวม rule ที่ผูก channel นั้น + rule ที่ channelId=null (global ทั้ง workspace) · scope workspace เสมอ
 * (bot engine เอาไปป้อน `applyBotRules` — ordering/enabled filter ทำซ้ำใน service ให้ปลอดภัย)
 */
export interface BotRuleRepository {
  listEnabled(workspaceId: WorkspaceId, channelId: ChannelId): Promise<BotRule[]>;
  /** (Phase 6 admin) rule ทั้งหมดของ workspace รวมที่ปิดอยู่ — เรียง priority · จอจัดการต้องเห็นของที่ปิดด้วย */
  listAll(workspaceId: WorkspaceId): Promise<BotRule[]>;
  findById(workspaceId: WorkspaceId, ruleId: BotRuleId): Promise<BotRule | null>;
  insert(rule: BotRule): Promise<void>;
  /** อัปเดตเฉพาะ field ที่ส่งมา · คืน rule หลังแก้ · null = ไม่มี rule นี้ใน workspace */
  update(workspaceId: WorkspaceId, ruleId: BotRuleId, patch: BotRulePatch): Promise<BotRule | null>;
  /** คืน true ถ้าลบจริง (false = ไม่มี rule นี้ใน workspace) */
  remove(workspaceId: WorkspaceId, ruleId: BotRuleId): Promise<boolean>;
}

/** field ที่แก้ได้ของ rule — id/workspaceId/createdAt แก้ไม่ได้ (identity) */
export type BotRulePatch = Partial<
  Pick<BotRule, 'channelId' | 'matchType' | 'pattern' | 'action' | 'enabled' | 'priority'>
>;

/**
 * WorkspaceBotConfigRepository — สวิตช์ automation ต่อ workspace (Phase 5)
 * bot consumer เรียก `get` ก่อนทำงาน → ไม่มี config (null) = bot ปิด (คง behavior เดิม · ดู ADR-0006)
 */
export interface WorkspaceBotConfigRepository {
  get(workspaceId: WorkspaceId): Promise<WorkspaceBotConfig | null>;
  /** (Phase 6 admin) ตั้งสวิตช์ — ไม่มี row = สร้างใหม่ · คืนค่าหลังบันทึก */
  upsert(config: WorkspaceBotConfig): Promise<WorkspaceBotConfig>;
}

/**
 * WorkspaceEntitlementsRepository — โมดูลที่ workspace ซื้อไว้ (Phase 6 · ADR-0007)
 * `null` = ไม่มี row = **ไม่มีสิทธิ์อะไรเลย** (fail-closed) — caller ใช้คู่กับ `hasEntitlement`
 */
export interface WorkspaceEntitlementsRepository {
  get(workspaceId: WorkspaceId): Promise<WorkspaceEntitlements | null>;
}

/** ข้อมูลที่ AI ใช้ตัดสินใจตอบ (Phase 5B · MVP = ข้อความลูกค้าล่าสุดอย่างเดียว → ลด PII ที่ส่งออกนอกระบบ) */
export interface BotAiReplyInput {
  /** ข้อความลูกค้าล่าสุด (plaintext) */
  text: string;
}

/** ผล AI: ตอบได้ (reply) หรือยอมแพ้/ต้องใช้คน (escalate) */
export type BotAiDecision = { kind: 'reply'; text: string } | { kind: 'escalate' };

export interface BotAiError {
  code: 'ai_failed';
  message: string;
}

/**
 * BotAiReplier — ถาม AI ช่วยตอบลูกค้า (Phase 5B · ใช้เมื่อ rule ไม่ match + workspace เปิด aiEnabled)
 * network boundary → คืน Result · caller (bot consumer) แปลง err/escalate → คืนสายเข้า queue (fail-safe หา human)
 * ⚠️ PII: ข้อความลูกค้าวิ่งออกนอกระบบไป provider — ต้อง per-workspace opt-in + ห้าม log เต็ม (ดู ADR-0006)
 * adapter (`@omni/bot-anthropic`) เป็นคน implement — domain รู้แค่ port นี้ (ไม่ผูก provider)
 */
export interface BotAiReplier {
  reply(input: BotAiReplyInput): Promise<Result<BotAiDecision, BotAiError>>;
}

/** ---- Inbox read-model (Phase 3: agent inbox — query ล้วน ไม่มี business logic) ---- */

/** สรุป conversation หนึ่งแถวใน inbox list (conversation + ชื่อ contact + ข้อความล่าสุด) */
export interface ConversationListItem {
  conversation: Conversation;
  /** ชื่อ contact (null ถ้าช่องทางไม่ให้ชื่อ) */
  contactName: string | null;
  /** ข้อความล่าสุดของสาย (null ถ้าสายยังไม่มีข้อความ — ปกติมีเสมอ) */
  lastMessage: {
    direction: MessageDirection;
    content: MessageContent;
    createdAt: Date;
  } | null;
}

/** ตัวเลือก paginate แบบ cursor ด้วยเวลา (เลื่อนดูของเก่าลงไป) */
export interface InboxPageOptions {
  limit: number;
  /** เอาเฉพาะที่เก่ากว่าเวลานี้ (cursor) — undefined = หน้าแรก (ใหม่สุด) */
  before?: Date;
}

/**
 * InboxReadRepository — read-model สำหรับ agent inbox
 * ทุก method scope ด้วย `workspaceId` (agent เห็นเฉพาะ workspace ตัวเอง — กัน cross-tenant)
 */
export interface InboxReadRepository {
  /** conversation ใน workspace เรียงใหม่→เก่า (by lastMessageAt) */
  listConversations(
    workspaceId: WorkspaceId,
    options: InboxPageOptions,
  ): Promise<ConversationListItem[]>;

  /** ข้อความในสายหนึ่ง เรียงใหม่→เก่า (by createdAt) · scope workspace กันดูข้ามสาย/ข้าม tenant */
  listMessages(
    workspaceId: WorkspaceId,
    conversationId: ConversationId,
    options: InboxPageOptions,
  ): Promise<Message[]>;

  /** หา message รายตัวจาก id (scope workspace) — consumer ใช้ประกอบ event ตอน fan-out realtime */
  getMessageById(workspaceId: WorkspaceId, messageId: MessageId): Promise<Message | null>;

  /** หา conversation หนึ่งแถวแบบ list-item (scope workspace) — consumer ใช้ push conversation.updated */
  getConversationListItem(
    workspaceId: WorkspaceId,
    conversationId: ConversationId,
  ): Promise<ConversationListItem | null>;
}

/** ผลลัพธ์การส่ง outbound จาก provider */
export interface OutboundReceipt {
  /** id ที่ provider คืนมา (ไว้ trace/dedup) — null ถ้าไม่มี (เช่น web ไม่มี provider id) */
  externalId: string | null;
  /**
   * ปลายทางรับได้จริงไหมในตอนนี้ — web: มี socket live ต่ออยู่รับ (true) หรือ widget offline (false)
   * false ไม่ใช่ error: message persist ไว้แล้ว widget จะดึง history ตอน reconnect (Phase 3)
   */
  delivered: boolean;
}
export interface OutboundError {
  code: 'send_failed';
  message: string;
}

/**
 * OutboundGateway — ส่ง message ออกไปยังช่องทางภายนอก (Phase 2 item 5: channel-web + WS)
 * คืน Result เพราะเป็น network boundary — caller ต้อง handle failure/retry
 */
export interface OutboundGateway {
  send(message: Message): Promise<Result<OutboundReceipt, OutboundError>>;
}

/**
 * DomainEvent — seam ของ EventBus/outbox (→ pg-boss ภายหลัง)
 * นิยามด้วย zod เพราะ event จะถูก serialize ข้าม process — ต้อง validate ได้
 */
export const domainEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('inbound_message.received'),
    workspaceId: idSchema('ws'),
    channelId: idSchema('chn'),
    conversationId: idSchema('conv'),
    contactId: idSchema('ctc'),
    messageId: idSchema('msg'),
    // สายนี้เพิ่งถูกเปิดในรอบนี้ไหม — bot consumer ใช้แยก "สายใหม่ (auto-own)" ออกจาก "สาย escalate ค้าง" (Phase 5)
    conversationCreated: z.boolean(),
    occurredAt: z.date(),
  }),
  // agent/bot ตอบกลับ → agent inbox คนอื่นใน workspace เห็น sync (consumer re-fetch message ตาม id)
  z.object({
    type: z.literal('outbound_message.sent'),
    workspaceId: idSchema('ws'),
    channelId: idSchema('chn'),
    conversationId: idSchema('conv'),
    messageId: idSchema('msg'),
    occurredAt: z.date(),
  }),
  // outbound ส่งไม่ถึงช่องทาง (deliver ล้มหลัง retry) → agent เห็นสถานะ message เป็น 'failed' realtime
  // (consumer re-fetch message ตาม id เหมือน outbound_message.sent — status ตอนนี้ = failed แล้ว)
  z.object({
    type: z.literal('outbound_message.failed'),
    workspaceId: idSchema('ws'),
    channelId: idSchema('chn'),
    conversationId: idSchema('conv'),
    messageId: idSchema('msg'),
    occurredAt: z.date(),
  }),
  // conversation เปลี่ยน (assign/unassign/close/reopen — Phase 4) → agent เห็น badge/สถานะ sync
  // consumer re-fetch conversation list-item ตาม id (ไม่มี messageId)
  z.object({
    type: z.literal('conversation.updated'),
    workspaceId: idSchema('ws'),
    conversationId: idSchema('conv'),
    occurredAt: z.date(),
  }),
]);
export type DomainEvent = z.infer<typeof domainEventSchema>;

/** EventBus — publish domain event · impl แรกเป็น in-process, ต่อ pg-boss ภายหลังโดยไม่แตะ core */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
}
