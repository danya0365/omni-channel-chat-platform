import { z } from 'zod';
import { idSchema } from '../ids';
import type { Clock, IdGenerator } from '../ids';
import { err, ok } from '../result';
import type { Result } from '../result';
import { messageContentSchema, messageSenderSchema } from '../schema/message';
import type { Message } from '../schema/message';
import type {
  ConversationRepository,
  EventBus,
  MessageRepository,
  OutboundGateway,
} from '../ports';

/**
 * command ส่ง outbound หนึ่งข้อความเข้า conversation (agent/bot ตอบกลับ)
 * Phase 2: เรียกจาก demo reply endpoint · Phase 3 = จาก agent inbox (มี auth + agentId จริง)
 */
export const sendOutboundCommandSchema = z.object({
  workspaceId: idSchema('ws'),
  channelId: idSchema('chn'),
  conversationId: idSchema('conv'),
  content: messageContentSchema,
  /** ผู้ส่ง — default bot (agent identity จริงมาใน Phase 3 auth) · outbound ไม่ควรเป็น contact */
  sender: messageSenderSchema.default({ kind: 'bot' }),
});
export type SendOutboundCommand = z.input<typeof sendOutboundCommandSchema>;

export interface SendOutboundResult {
  message: Message;
  /** ปลายทางรับได้จริงตอนนี้ไหม (web: มี socket live รับ) — false = persist แล้วแต่ยังไม่ถึง (offline) */
  delivered: boolean;
  /** id ฝั่ง provider (ถ้ามี) — web = null */
  externalId: string | null;
}

export type SendOutboundError =
  | { code: 'invalid_command'; message: string }
  | { code: 'conversation_not_found'; message: string }
  | { code: 'send_failed'; message: string };

/**
 * สัญญาของ "ส่ง outbound หนึ่งข้อความ" แบบ command → Result (ประกอบ persist+deliver ที่ composition root)
 * แยก type ไว้ให้ apps/api ผูก AppDeps โดยไม่ผูกกับรูปแบบ internal (persist/deliver แยกกัน)
 */
export type SendOutboundMessage = (
  input: SendOutboundCommand,
) => Promise<Result<SendOutboundResult, SendOutboundError>>;

/* ------------------------------------------------------------------ *
 * แยก persist (ใน DB tx) ออกจาก deliver (network นอก tx)
 * เหตุผล: ยิง provider ไกล (LINE push) ต้อง **ไม่ถือ DB transaction ค้าง** ระหว่างรอ network
 * (ถือ lock + กิน connection pool เมื่อ provider ช้า/ล่ม) — composition root เป็นคนเย็บ 2 เฟส
 * ------------------------------------------------------------------ */

/** deps ของเฟส persist — ไม่มี outbound gateway (ยังไม่ยิงช่องทาง) */
export interface PersistOutboundDeps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  events: EventBus;
  generateId: IdGenerator;
  now: Clock;
}

export interface PersistedOutbound {
  message: Message;
}

/**
 * เฟส 1 — persist outbound message (source of truth) + publish event · **รันใน DB tx**
 *   เช็ค conversation มีจริง → ประกอบ message (status 'sent' optimistic) → persist → touch → publish
 * ยังไม่ยิงช่องทาง — เฟส deliver แยกทำนอก tx · infra error (db ล่ม) = throw (api map 5xx)
 */
export function createPersistOutboundMessage(deps: PersistOutboundDeps) {
  const { conversations, messages, events, generateId, now } = deps;

  return async function persistOutboundMessage(
    input: SendOutboundCommand,
  ): Promise<Result<PersistedOutbound, SendOutboundError>> {
    const parsed = sendOutboundCommandSchema.safeParse(input);
    if (!parsed.success) {
      return err({ code: 'invalid_command', message: parsed.error.message });
    }
    const command = parsed.data;
    const { workspaceId, channelId, conversationId } = command;

    // conversation ต้องมีจริง + อยู่ workspace + ช่องทางเดียวกัน (กัน cross-tenant / ผิดช่องทาง)
    const conversation = await conversations.findById(workspaceId, conversationId);
    if (!conversation || conversation.channelId !== channelId) {
      return err({
        code: 'conversation_not_found',
        message: 'conversation not found in this channel',
      });
    }

    const at = now();
    const message: Message = {
      id: generateId('msg'),
      workspaceId,
      conversationId,
      channelId,
      direction: 'outbound',
      sender: command.sender,
      content: command.content,
      // optimistic: persist = ความจริง · เฟส deliver อัปเป็น 'failed' ถ้าช่องทางล้ม
      status: 'sent',
      externalId: null,
      createdAt: at,
    };
    await messages.insert(workspaceId, message);
    await conversations.touch(workspaceId, conversationId, at);

    // publish (→ outbox ใน tx เดียวกับ persist) — agent inbox คนอื่นเห็น reply sync ทันทีหลัง commit
    await events.publish({
      type: 'outbound_message.sent',
      workspaceId,
      channelId,
      conversationId,
      messageId: message.id,
      occurredAt: at,
    });

    return ok({ message });
  };
}

/** deps ของเฟส deliver — ยิงช่องทาง + อัปสถานะ/แจ้ง event เมื่อผลออก (นอก tx) */
export interface DeliverOutboundDeps {
  outbound: OutboundGateway;
  messages: MessageRepository;
  events: EventBus;
  now: Clock;
}

/**
 * เฟส 2 — deliver message ที่ persist แล้วออกช่องทาง · **รันนอก DB tx** (network boundary)
 *   ยิง outbound.send → สำเร็จ: คืน delivered/externalId · ล้ม (retry หมดแล้ว): mark 'failed' +
 *   publish `outbound_message.failed` (→ agent เห็นสถานะ realtime) + คืน send_failed
 * message ยัง persist เป็นความจริงเสมอ (persist-before-deliver) — ล้มแค่สะท้อนสถานะ ไม่ลบ
 */
export function createDeliverOutboundMessage(deps: DeliverOutboundDeps) {
  const { outbound, messages, events, now } = deps;

  return async function deliverOutboundMessage(
    message: Message,
  ): Promise<Result<SendOutboundResult, SendOutboundError>> {
    const receipt = await outbound.send(message);
    if (!receipt.ok) {
      await messages.updateStatus(message.workspaceId, message.id, 'failed');
      await events.publish({
        type: 'outbound_message.failed',
        workspaceId: message.workspaceId,
        channelId: message.channelId,
        conversationId: message.conversationId,
        messageId: message.id,
        occurredAt: now(),
      });
      return err({ code: 'send_failed', message: receipt.error.message });
    }

    return ok({
      message,
      delivered: receipt.value.delivered,
      externalId: receipt.value.externalId,
    });
  };
}
