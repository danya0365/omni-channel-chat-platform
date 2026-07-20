import { z } from 'zod';
import { idSchema } from '../ids';
import type { Clock, IdGenerator } from '../ids';
import { err, ok } from '../result';
import type { Result } from '../result';
import { messageContentSchema } from '../schema/message';
import type { Contact, ContactIdentity } from '../schema/contact';
import type { Conversation } from '../schema/conversation';
import type { Message } from '../schema/message';
import type {
  ContactRepository,
  ConversationRepository,
  EventBus,
  MessageRepository,
} from '../ports';

/** deps ที่ service ต้องใช้ — wire ที่ composition root (apps/api) */
export interface IngestInboundDeps {
  contacts: ContactRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
  events: EventBus;
  generateId: IdGenerator;
  now: Clock;
}

/**
 * command ของ inbound หนึ่งข้อความจากช่องทาง
 * adapter แต่ละช่องทาง map payload ดิบ → command นี้ก่อนเรียก service (core ไม่รู้จัก payload ดิบ)
 */
export const ingestInboundCommandSchema = z.object({
  workspaceId: idSchema('ws'),
  channelId: idSchema('chn'),
  /** id ผู้ส่งบนช่องทาง (เช่น visitor id ของ web) — ใช้ resolve identity */
  externalId: z.string().min(1),
  content: messageContentSchema,
  /** ชื่อ contact ที่ช่องทางให้มา (ถ้ามี) — ใช้ตอนสร้าง contact ใหม่ */
  contactName: z.string().min(1).nullish(),
  /** id message ฝั่ง provider (ถ้ามี) — เก็บไว้ trace/dedup */
  externalMessageId: z.string().min(1).nullish(),
});
export type IngestInboundCommand = z.infer<typeof ingestInboundCommandSchema>;

export interface IngestInboundResult {
  message: Message;
  conversation: Conversation;
  contact: Contact;
  /** อะไรถูกสร้างใหม่ในรอบนี้ (contact ใหม่ = คนใหม่, conversation ใหม่ = เปิดสายใหม่) */
  created: { contact: boolean; conversation: boolean };
  /** true = message นี้เคยรับแล้ว (external_id ซ้ำ = webhook redelivery) → ไม่ persist/ไม่ publish ซ้ำ */
  deduped: boolean;
}

export type IngestInboundError = { code: 'invalid_command'; message: string };

/**
 * ingestInboundMessage — รับ inbound หนึ่งข้อความ:
 *   resolve identity → contact (หา/สร้าง) → conversation open (หา/เปิดใหม่) → persist message → publish event
 *
 * คืน Result เพราะเป็น external boundary (webhook) — validation fail = err
 * ส่วน infra error (db ล่ม) ให้ throw ตามปกติ (exceptional จริง — api map เป็น 5xx)
 */
export function createIngestInboundMessage(deps: IngestInboundDeps) {
  const { contacts, conversations, messages, events, generateId, now } = deps;

  return async function ingestInboundMessage(
    input: IngestInboundCommand,
  ): Promise<Result<IngestInboundResult, IngestInboundError>> {
    const parsed = ingestInboundCommandSchema.safeParse(input);
    if (!parsed.success) {
      return err({ code: 'invalid_command', message: parsed.error.message });
    }
    const command = parsed.data;
    const { workspaceId, channelId, externalId } = command;
    const at = now();

    // 1. resolve identity → contact (หา หรือ สร้างใหม่พร้อม identity แรก)
    let contact: Contact;
    let contactCreated = false;
    const existing = await contacts.findByChannelIdentity(workspaceId, channelId, externalId);
    if (existing) {
      contact = existing.contact;
    } else {
      contact = {
        id: generateId('ctc'),
        workspaceId,
        displayName: command.contactName ?? null,
        createdAt: at,
      };
      const identity: ContactIdentity = {
        id: generateId('idn'),
        workspaceId,
        contactId: contact.id,
        channelId,
        externalId,
        createdAt: at,
      };
      await contacts.insertContactWithIdentity(workspaceId, contact, identity);
      contactCreated = true;
    }

    // 2. resolve conversation (open ล่าสุด หรือ เปิดใหม่) — contact ใหม่ย่อมไม่มี conversation เดิม
    let conversation: Conversation;
    let conversationCreated = false;
    const openConversation = contactCreated
      ? null
      : await conversations.findLatestOpen(workspaceId, contact.id, channelId);
    if (openConversation) {
      conversation = openConversation;
    } else {
      conversation = {
        id: generateId('conv'),
        workspaceId,
        contactId: contact.id,
        channelId,
        status: 'open',
        assignee: null,
        createdAt: at,
        lastMessageAt: at,
      };
      await conversations.insert(workspaceId, conversation);
      conversationCreated = true;
    }

    // 3. สร้าง message inbound + persist
    const message: Message = {
      id: generateId('msg'),
      workspaceId,
      conversationId: conversation.id,
      channelId,
      direction: 'inbound',
      sender: { kind: 'contact', contactId: contact.id },
      content: command.content,
      status: 'received',
      externalId: command.externalMessageId ?? null,
      createdAt: at,
    };
    const { inserted } = await messages.insert(workspaceId, message);

    // 3.5 dedup: external_id ชน (webhook redelivery ซ้ำ) → idempotent: ไม่ touch/ไม่ publish event ซ้ำ
    //     คืน deduped=true ให้ caller รู้ว่าไม่มีอะไรใหม่ (message.id ที่คืนเป็นตัวที่ไม่ได้ persist — อย่าใช้ต่อ)
    if (!inserted) {
      return ok({
        message,
        conversation,
        contact,
        created: { contact: contactCreated, conversation: conversationCreated },
        deduped: true,
      });
    }

    // 4. เด้ง lastMessageAt ถ้าใช้ conversation เดิม (ของใหม่ตั้ง lastMessageAt = at อยู่แล้ว)
    if (!conversationCreated) {
      await conversations.touch(workspaceId, conversation.id, at);
      conversation = { ...conversation, lastMessageAt: at };
    }

    // 5. publish domain event (seam → outbox/pg-boss ภายหลัง)
    await events.publish({
      type: 'inbound_message.received',
      workspaceId,
      channelId,
      conversationId: conversation.id,
      contactId: contact.id,
      messageId: message.id,
      conversationCreated,
      occurredAt: at,
    });

    return ok({
      message,
      conversation,
      contact,
      created: { contact: contactCreated, conversation: conversationCreated },
      deduped: false,
    });
  };
}
