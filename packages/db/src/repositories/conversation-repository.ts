import { and, desc, eq } from 'drizzle-orm';
import { conversationSchema } from '@omni/domain';
import type { ConversationRepository } from '@omni/domain';
import type { Database } from '../client';
import { conversations } from '../schema';

/** ConversationRepository (Postgres) — scope workspaceId ทุก query */
export function createConversationRepository(db: Database): ConversationRepository {
  return {
    findLatestOpen: async (workspaceId, contactId, channelId) => {
      const rows = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, workspaceId),
            eq(conversations.contactId, contactId),
            eq(conversations.channelId, channelId),
            eq(conversations.status, 'open'),
          ),
        )
        .orderBy(desc(conversations.lastMessageAt))
        .limit(1);

      const row = rows[0];
      return row ? conversationSchema.parse(row) : null;
    },

    insert: async (_workspaceId, conversation) => {
      await db.insert(conversations).values(conversation);
    },

    touch: async (workspaceId, conversationId, lastMessageAt) => {
      await db
        .update(conversations)
        .set({ lastMessageAt })
        .where(
          and(eq(conversations.workspaceId, workspaceId), eq(conversations.id, conversationId)),
        );
    },
  };
}
