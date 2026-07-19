import { and, eq } from 'drizzle-orm';
import type { Message } from '@omni/domain';
import type { Database } from '../client';
import { contactIdentities, conversations } from '../schema';

/**
 * WebRouteResolver — สำหรับ outbound ของ web channel: จาก outbound message (มี conversationId)
 * หา `externalId` (= sessionId) ของ contact บนช่องทางนั้น เพื่อ route เข้า WS ของ session ที่ต่ออยู่
 *
 * คืน string (externalId) ให้ตรง type `WebRouteResolver` ที่ `@omni/channel-web` ประกาศไว้ —
 * แต่ที่นี่ผูกกับ `@omni/domain` (Message) เท่านั้น ไม่ import channel-web (กัน adapter พึ่ง adapter);
 * composition root (apps/api) เป็นคนต่อ resolver ↔ gateway (structural typing bridge ให้)
 *
 * ผูก 3 คีย์ (workspace, contact, channel) → contact_identities · scope workspace เสมอ
 */
export function createWebRouteResolver(db: Database) {
  return async function resolveWebRoute(message: Message): Promise<string | null> {
    const rows = await db
      .select({ externalId: contactIdentities.externalId })
      .from(conversations)
      .innerJoin(
        contactIdentities,
        and(
          eq(contactIdentities.workspaceId, conversations.workspaceId),
          eq(contactIdentities.contactId, conversations.contactId),
          eq(contactIdentities.channelId, conversations.channelId),
        ),
      )
      .where(
        and(
          eq(conversations.workspaceId, message.workspaceId),
          eq(conversations.channelId, message.channelId),
          eq(conversations.id, message.conversationId),
        ),
      )
      .limit(1);

    return rows[0]?.externalId ?? null;
  };
}
