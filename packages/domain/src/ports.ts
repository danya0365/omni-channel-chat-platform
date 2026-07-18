import { z } from 'zod';
import { idSchema } from './ids';
import type { WorkspaceId, ChannelId, ContactId, ConversationId } from './ids';
import type { Result } from './result';
import type { Channel } from './schema/channel';
import type { Contact, ContactIdentity } from './schema/contact';
import type { Conversation } from './schema/conversation';
import type { Message } from './schema/message';

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
}

export interface MessageRepository {
  insert(workspaceId: WorkspaceId, message: Message): Promise<void>;
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
    occurredAt: z.date(),
  }),
]);
export type DomainEvent = z.infer<typeof domainEventSchema>;

/** EventBus — publish domain event · impl แรกเป็น in-process, ต่อ pg-boss ภายหลังโดยไม่แตะ core */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
}
