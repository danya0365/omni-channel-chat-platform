import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { conversationSchema, messageContentSchema, messageSchema } from '@omni/domain';
import type { InboxReadRepository } from '@omni/domain';
import type { Executor } from '../client';
import { contacts, conversations, messages } from '../schema';

/**
 * InboxReadRepository (Postgres) — read-model ของ agent inbox
 * ทุก query scope ด้วย workspaceId · DB→domain map ผ่าน zod parse ที่ boundary
 */
export function createInboxReadRepository(db: Executor): InboxReadRepository {
  return {
    listConversations: async (workspaceId, { limit, before }) => {
      // 1. conversation + ชื่อ contact เรียงใหม่→เก่า (cursor = lastMessageAt)
      const convRows = await db
        .select({ conversation: conversations, contactName: contacts.displayName })
        .from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(
          before
            ? and(
                eq(conversations.workspaceId, workspaceId),
                lt(conversations.lastMessageAt, before),
              )
            : eq(conversations.workspaceId, workspaceId),
        )
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit);

      if (convRows.length === 0) return [];

      // 2. ข้อความล่าสุดของแต่ละสาย (distinct on conversation_id → createdAt ล่าสุด)
      const convIds = convRows.map((r) => r.conversation.id);
      const lastRows = await db
        .selectDistinctOn([messages.conversationId])
        .from(messages)
        .where(
          and(eq(messages.workspaceId, workspaceId), inArray(messages.conversationId, convIds)),
        )
        .orderBy(messages.conversationId, desc(messages.createdAt));

      const lastByConv = new Map(lastRows.map((m) => [m.conversationId, m]));

      return convRows.map((r) => {
        const last = lastByConv.get(r.conversation.id);
        return {
          conversation: conversationSchema.parse(r.conversation),
          contactName: r.contactName ?? null,
          lastMessage: last
            ? {
                direction: last.direction,
                content: messageContentSchema.parse(last.content),
                createdAt: last.createdAt,
              }
            : null,
        };
      });
    },

    listMessages: async (workspaceId, conversationId, { limit, before }) => {
      const rows = await db
        .select()
        .from(messages)
        .where(
          before
            ? and(
                eq(messages.workspaceId, workspaceId),
                eq(messages.conversationId, conversationId),
                lt(messages.createdAt, before),
              )
            : and(
                eq(messages.workspaceId, workspaceId),
                eq(messages.conversationId, conversationId),
              ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      return rows.map((r) => messageSchema.parse(r));
    },

    getMessageById: async (workspaceId, messageId) => {
      const rows = await db
        .select()
        .from(messages)
        .where(and(eq(messages.workspaceId, workspaceId), eq(messages.id, messageId)))
        .limit(1);
      const row = rows[0];
      return row ? messageSchema.parse(row) : null;
    },
  };
}
