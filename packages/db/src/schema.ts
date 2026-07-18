import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Multi-tenant root — ทุก entity ในระบบ (channel/contact/conversation/message/agent)
 * จะผูก workspaceId กับตารางนี้ (เพิ่มใน Phase 2). scope ทุก query ด้วย workspaceId เสมอ
 */
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
