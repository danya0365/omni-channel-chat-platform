import { z } from 'zod';
import { idSchema } from '../ids';
import type { Clock, IdGenerator } from '../ids';
import { err, ok } from '../result';
import type { Result } from '../result';
import { messageContentSchema, messageSenderSchema } from '../schema/message';
import type { Message } from '../schema/message';
import type { ConversationRepository, MessageRepository, OutboundGateway } from '../ports';

/** deps ที่ service ต้องใช้ — wire ที่ composition root (apps/api) */
export interface SendOutboundDeps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  outbound: OutboundGateway;
  generateId: IdGenerator;
  now: Clock;
}

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
 * sendOutboundMessage — ส่งข้อความออกไปยังช่องทาง:
 *   เช็ค conversation มีจริง → ประกอบ outbound message → persist (source of truth) → touch → ส่งออกช่องทาง
 *
 * persist ก่อนส่งเสมอ (message เป็นความจริงแม้ช่องทาง/ปลายทางล่ม) · คืน Result เพราะเป็น external boundary
 * infra error (db ล่ม) = throw ตามปกติ (api map เป็น 5xx)
 */
export function createSendOutboundMessage(deps: SendOutboundDeps) {
  const { conversations, messages, outbound, generateId, now } = deps;

  return async function sendOutboundMessage(
    input: SendOutboundCommand,
  ): Promise<Result<SendOutboundResult, SendOutboundError>> {
    const parsed = sendOutboundCommandSchema.safeParse(input);
    if (!parsed.success) {
      return err({ code: 'invalid_command', message: parsed.error.message });
    }
    const command = parsed.data;
    const { workspaceId, channelId, conversationId } = command;

    // 1. conversation ต้องมีจริง + อยู่ workspace + ช่องทางเดียวกัน (กัน cross-tenant / ผิดช่องทาง)
    const conversation = await conversations.findById(workspaceId, conversationId);
    if (!conversation || conversation.channelId !== channelId) {
      return err({
        code: 'conversation_not_found',
        message: 'conversation not found in this channel',
      });
    }

    const at = now();

    // 2. ประกอบ outbound message + persist ก่อนยิงออกช่องทาง
    const message: Message = {
      id: generateId('msg'),
      workspaceId,
      conversationId,
      channelId,
      direction: 'outbound',
      sender: command.sender,
      content: command.content,
      status: 'sent',
      externalId: null,
      createdAt: at,
    };
    await messages.insert(workspaceId, message);
    await conversations.touch(workspaceId, conversationId, at);

    // 3. ส่งออกช่องทาง (web = push เข้า WS ของ session ที่ต่ออยู่)
    const receipt = await outbound.send(message);
    if (!receipt.ok) {
      // ช่องทางล้มจริง — message ยัง persist ไว้ (สถานะ sent) · caller ตัดสินใจ retry ระดับบน
      return err({ code: 'send_failed', message: receipt.error.message });
    }

    return ok({
      message,
      delivered: receipt.value.delivered,
      externalId: receipt.value.externalId,
    });
  };
}
