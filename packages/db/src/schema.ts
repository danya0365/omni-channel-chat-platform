import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  Assignee,
  BotRuleAction,
  EntitlementModule,
  MessageContent,
  MessageSender,
} from '@omni/domain';

/**
 * Drizzle schema = source of truth ของ DB (migration generate จากไฟล์นี้)
 * infra adapter: map domain entity ↔ row · raw provider payload (JSONB) อยู่ที่นี่เท่านั้น
 *
 * Multi-tenant: ทุกตารางมี workspaceId (FK → workspaces, onDelete cascade)
 * scope ทุก query ด้วย workspaceId เสมอ (บังคับผ่าน repository ports)
 * union types (content/sender/assignee) เก็บเป็น jsonb + typed ด้วย @omni/domain (ยืดหยุ่น ไม่ต้อง migrate ต่อชนิด)
 */

export const channelType = pgEnum('channel_type', ['web', 'line']);
export const messageDirection = pgEnum('message_direction', ['inbound', 'outbound']);
export const deliveryStatus = pgEnum('delivery_status', [
  'received',
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
]);
export const conversationStatus = pgEnum('conversation_status', ['open', 'closed']);

/** Workspace = tenant root — ทุก entity ผูกกับตารางนี้ */
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Channel = instance ช่องทางที่ตั้งค่าใน workspace (Phase 2: web) */
export const channels = pgTable('channels', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  type: channelType('type').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Contact = ตัวตนลูกค้าแบบรวมข้ามช่องทาง */
export const contacts = pgTable('contacts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** ContactIdentity = ตัวตน contact บนช่องทางหนึ่ง · unique (workspace, channel, external) = resolve key */
export const contactIdentities = pgTable(
  'contact_identities',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ux_contact_identities_channel_external').on(
      t.workspaceId,
      t.channelId,
      t.externalId,
    ),
  ],
);

/** Conversation = สายสนทนาของ contact บนช่องทางหนึ่ง */
export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    status: conversationStatus('status').notNull().default('open'),
    assignee: jsonb('assignee').$type<Assignee>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // findLatestOpen: หา conversation open ล่าสุดของ contact บนช่องทาง
    index('ix_conversations_open_lookup').on(t.workspaceId, t.contactId, t.channelId, t.status),
    // inbox list: conversation ล่าสุดใน workspace ตามสถานะ
    index('ix_conversations_inbox').on(t.workspaceId, t.status, t.lastMessageAt),
  ],
);

/** Message = หน่วยข้อความกลาง (unified) — inbound/outbound ทุกช่องทาง */
export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    direction: messageDirection('direction').notNull(),
    sender: jsonb('sender').$type<MessageSender>().notNull(),
    content: jsonb('content').$type<MessageContent>().notNull(),
    status: deliveryStatus('status').notNull(),
    /** id ฝั่ง provider (idempotency/trace) */
    externalId: text('external_id'),
    /** payload ดิบจาก provider — เก็บที่นี่เท่านั้น ไม่ให้รั่วเข้า core */
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ix_messages_conversation').on(t.workspaceId, t.conversationId, t.createdAt),
    // dedup: กัน webhook redelivery (at-least-once) สร้าง message ซ้ำ — external_id = provider message id
    // partial: outbound + web ที่ external_id = null ถูก exclude (ไม่ dedup ผิดฝั่ง)
    uniqueIndex('ux_messages_external')
      .on(t.workspaceId, t.externalId)
      .where(sql`${t.externalId} is not null`),
  ],
);

/**
 * Agent = ทีมงานที่ login เข้า inbox (Phase 3) · passwordHash เก็บที่นี่ (infra) — domain ไม่รู้จัก
 * ⚠️ MVP: email unique ทั้งระบบ (จุด login resolve จาก email ก่อนรู้ workspace) — ดู AgentRepository
 */
export const agents = pgTable(
  'agents',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ux_agents_email').on(t.email)],
);

/**
 * Outbox = transactional outbox — เขียน domain event ใน tx เดียวกับ business write (กัน event หายตอน crash)
 * relay/worker (pg-boss) อ่านแถวที่ยังไม่ processed → fan-out เข้า agent WS → mark processed
 * payload = event แบบ JSON-safe (occurredAt เป็น ISO string) · ⚠️ ห้ามใส่ PII เกินจำเป็น (เก็บแค่ ids)
 */
export const outbox = pgTable(
  'outbox',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    // ⚠️ precision: 3 (ms) — cursor ของ multi-subscriber (outbox_cursors) เทียบ created_at กับค่า
    // ที่อ่านผ่าน JS Date (ms). ถ้าคอลัมน์เป็น µs (default) ค่าที่ store กลับจะต่ำกว่าจริง → row เดิมโผล่ซ้ำทุกครั้ง
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    /** null = ยังไม่ประมวลผล · มีค่า = fan-out แล้ว (relay ข้าม) */
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  // relay poll: หา event ที่ยังไม่ processed เรียงเก่า→ใหม่ (FIFO)
  (t) => [index('ix_outbox_unprocessed').on(t.processedAt, t.createdAt)],
);

/**
 * ChannelCredentials (Phase 4) — secret ต่อ channel (LINE channel access token + channel secret ฯลฯ)
 * เก็บ **encrypted at rest**: `secretCipher` = AES-256-GCM ของ JSON credential blob (ดู crypto.ts)
 * 1:1 กับ channel (channelId เป็น PK) · decrypt เฉพาะใน adapter ตอน verify webhook / push outbound
 * ⚠️ ห้าม log plaintext · domain ไม่รู้จักตารางนี้ (credential เป็น infra ล้วน — ดู ADR-0004)
 */
export const channelCredentials = pgTable('channel_credentials', {
  channelId: text('channel_id')
    .primaryKey()
    .references(() => channels.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  /** ciphertext (v1.<iv>.<tag>.<ct>) ของ JSON credential — ไม่มี plaintext ใน DB */
  secretCipher: text('secret_cipher').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * BotRule (Phase 5 automation) — กติกา "ถ้าข้อความ contains pattern → action (reply/escalate)" ต่อ workspace
 * channelId = null → ใช้ทุกช่องทาง · priority น้อยตรวจก่อน · action เป็น jsonb typed ($type<BotRuleAction>)
 * ⚠️ ไม่ใช่ secret → plaintext (แยกจาก channel_credentials) · domain zod (botRuleSchema) validate ตอน repo อ่าน · ดู ADR-0006
 */
export const botRules = pgTable(
  'bot_rules',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').references(() => channels.id, { onDelete: 'cascade' }),
    /** วิธี match — MVP 'contains' (text ไม่ enum เพื่อเพิ่ม matchType ทีหลังไม่ต้อง ALTER TYPE) */
    matchType: text('match_type').notNull(),
    pattern: text('pattern').notNull(),
    action: jsonb('action').$type<BotRuleAction>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    priority: integer('priority').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // lookup: rules ที่ enabled ของ workspace (+ channel/global) เรียง priority
  (t) => [index('ix_bot_rules_lookup').on(t.workspaceId, t.channelId, t.enabled)],
);

/**
 * OutboxCursor (Phase 5) — cursor ต่อ subscriber สำหรับ multi-subscriber outbox (additive · ดู ADR-0006)
 * agent WS consumer เดิมยังใช้ `outbox.processed_at` · subscriber ใหม่ (เช่น 'bot') track ตำแหน่งเองที่นี่
 * cursor = (last_created_at, last_id) · claim batch = lock row นี้ (FOR UPDATE) กันหลาย instance ชน
 */
export const outboxCursors = pgTable('outbox_cursors', {
  subscriber: text('subscriber').primaryKey(),
  // precision: 3 ให้ตรงกับ outbox.created_at (ms) — เทียบ cursor แบบ (created_at, id) ได้ตรง ไม่ off-by-µs
  lastCreatedAt: timestamp('last_created_at', { withTimezone: true, precision: 3 }),
  lastId: text('last_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * WorkspaceBotConfig (Phase 5) — สวิตช์ automation ต่อ workspace (1:1 กับ workspace, workspaceId เป็น PK)
 * botEnabled = bot รับสายใหม่ + ตอบตาม rules · aiEnabled = (5B) fallback ถาม Claude
 * ⚠️ ไม่มี row = bot ปิด (คง behavior เดิม) · default ปิดทั้งคู่ (AI = PII opt-in) · ดู ADR-0006
 */
export const workspaceBotConfig = pgTable('workspace_bot_config', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  botEnabled: boolean('bot_enabled').notNull().default(false),
  aiEnabled: boolean('ai_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * WorkspaceEntitlements (Phase 6) — โมดูลที่ workspace นี้ "ซื้อไว้" (1:1 กับ workspace, workspaceId เป็น PK)
 *
 * เก็บเป็น **jsonb array ของ module id** ไม่ใช่คอลัมน์ boolean ต่อโมดูล → เพิ่มโมดูลใหม่ไม่ต้อง migration
 * ⚠️ **ไม่มี row = ไม่มีสิทธิ์อะไรเลย** (fail-closed) · default `[]` สำหรับ row ที่สร้างแล้วยังไม่ซื้ออะไร
 * ⚠️ additive — ไม่แทนที่ `workspace_bot_config`: สิทธิ์ (ซื้อไหม) กับสวิตช์ใช้งาน (เปิดไหม) คนละเรื่อง
 * ดู ADR-0007
 */
export const workspaceEntitlements = pgTable('workspace_entitlements', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  modules: jsonb('modules')
    .$type<EntitlementModule[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
