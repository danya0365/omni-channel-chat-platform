import { randomUUID } from 'node:crypto';
import {
  createDeliverOutboundMessage,
  createIngestInboundMessage,
  createManageConversation,
  createPersistOutboundMessage,
} from '@omni/domain';
import type {
  ChannelRepository,
  ConversationRepository,
  InboxReadRepository,
  ManageConversation,
  OutboundGateway,
} from '@omni/domain';
import {
  createAgentRepository,
  createBotRuleRepository,
  createChannelCredentialRepository,
  createChannelRepository,
  createContactRepository,
  createConversationRepository,
  createDb,
  createIdGenerator,
  createInboxReadRepository,
  createMessageRepository,
  createOutboxCursorStore,
  createOutboxEventBus,
  createOutboxStore,
  createWebRouteResolver,
  createWorkspaceBotConfigRepository,
  loadEncryptionKey,
  systemClock,
} from '@omni/db';
import type { DbHandle } from '@omni/db';
import { createWebOutboundGateway } from '@omni/channel-web';
import {
  createLineCredentialResolver,
  createLineHttpProfileClient,
  createLineHttpPushClient,
  createLineOutboundGateway,
  createLineProfileResolver,
} from '@omni/channel-line';
import type { LineCredentialResolver, LineFetch, LineProfileResolver } from '@omni/channel-line';
import type { AppDeps } from './deps';
import { createAuthService } from './auth/service';
import { createDispatchOutboundGateway } from './outbound-dispatch';
import { createRetryingOutboundGateway } from './outbound-retry';
import { createConnectionRegistry } from './registry';
import type { ConnectionRegistry } from './registry';
import { createBotConsumer } from './realtime/bot-consumer';
import { createOutboxConsumer } from './realtime/outbox-consumer';
import { createOutboxRelay } from './realtime/pg-boss-relay';

export interface Container {
  deps: AppDeps;
  /** เริ่ม background worker (pg-boss relay) — เรียกหลัง buildApp ก่อน listen */
  start: () => Promise<void>;
  /** ปิด relay + DB pool ตอน shutdown */
  close: () => Promise<void>;
}

export interface ContainerConfig {
  databaseUrl: string;
  /** secret สำหรับ sign session token (auth) */
  authSecret: string;
  /** key เข้ารหัส channel credential (hex 64/base64 ของ 32 byte) — ไม่ตั้ง = ใช้ dev key (ไม่ปลอดภัย) */
  channelEncryptionKey?: string;
  /** อายุ token (วินาที) — default 12 ชม. */
  tokenTtlSec?: number;
  /** ส่ง session cookie เฉพาะ HTTPS — prod=true (default) · dev/test อาจตั้ง false */
  cookieSecure?: boolean;
  /** origins ที่ยอมให้ยิง state-changing request (CSRF Origin check) — prod ตั้งเป็น origin ของ inbox */
  allowedOrigins?: string[];
  /** inject LINE fetch (push API) — test override เพื่อไม่ยิง api.line.me จริง · default = global fetch */
  lineFetch?: LineFetch;
}

const DEFAULT_TOKEN_TTL_SEC = 12 * 60 * 60;

/** dev-only encryption key (32 byte hex) — prod ต้องตั้ง CHANNEL_ENCRYPTION_KEY (ค่านี้ไม่ปลอดภัย ห้ามใช้จริง) */
export const DEV_CHANNEL_ENCRYPTION_KEY =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

/**
 * ประกอบ channel IO ของ outbound: credential resolver (decrypt) + gateway ต่อช่องทาง + dispatcher
 *
 * - route resolver = generic (message → externalId ของ identity บนช่องทาง) · web=sessionId, line=LINE userId
 * - dispatcher เลือก gateway ตาม channel type ของ conversation (service เรียก outbound.send เดียว ไม่รู้ช่องทาง)
 * คืน `lineCredentials` ด้วยเพราะ webhook route ใช้ verify signature (ใช้ตัวเดียวกับที่ decrypt ให้ push)
 */
function buildChannelIo(
  handle: DbHandle,
  registry: ConnectionRegistry,
  channels: ChannelRepository,
  channelEncryptionKey: string | undefined,
  lineFetch: LineFetch | undefined,
): {
  outbound: OutboundGateway;
  lineCredentials: LineCredentialResolver;
  lineProfile: LineProfileResolver;
} {
  const routeResolver = createWebRouteResolver(handle.db);

  const encryptionKey = loadEncryptionKey(channelEncryptionKey ?? DEV_CHANNEL_ENCRYPTION_KEY);
  const channelCredentials = createChannelCredentialRepository(handle.db, encryptionKey);
  const lineCredentials = createLineCredentialResolver((workspaceId, channelId) =>
    channelCredentials.get(workspaceId, channelId),
  );
  // resolve ชื่อ contact จาก LINE profile API (fetch เฉพาะตอน contact ใหม่ ที่ route) — reuse lineFetch seam
  const lineProfile = createLineProfileResolver({
    resolveCredentials: lineCredentials,
    client: createLineHttpProfileClient(lineFetch),
  });

  const webOutbound = createWebOutboundGateway({ registry, resolveRoute: routeResolver });
  const lineOutbound = createLineOutboundGateway({
    resolveRoute: routeResolver,
    resolveCredentials: lineCredentials,
    push: createLineHttpPushClient(lineFetch),
  });
  const dispatch = createDispatchOutboundGateway({
    resolveChannelType: async (message) => {
      const channel = await channels.findPublicById(message.channelId);
      return channel && channel.workspaceId === message.workspaceId ? channel.type : null;
    },
    byType: { web: webOutbound, line: lineOutbound },
  });
  // retry เฉพาะ deliver ที่ล้มชั่วคราว (LINE 5xx/timeout) — ยิงตอน deliver นอก tx · idempotent ผ่าน retry-key
  const outbound = createRetryingOutboundGateway(dispatch, { attempts: 3, backoffMs: [200, 600] });

  return { outbound, lineCredentials, lineProfile };
}

/**
 * ประกอบ sendOutbound = 2 เฟส: persist(ใน DB tx) → deliver(นอก tx) — แยกกัน God function ใน createContainer
 * - persist + outbox event = atomic ใน tx เดียว → หลัง commit `triggerDrain()` ให้ agent เห็น reply ทันที
 * - deliver ยิง provider (LINE push) **นอก tx** — repo ผูก pool ไม่ถือ lock/connection ระหว่างรอ network · ล้ม → mark 'failed'
 */
function buildSendOutbound(
  handle: DbHandle,
  outbound: OutboundGateway,
  generateId: ReturnType<typeof createIdGenerator>,
  triggerDrain: () => void,
): AppDeps['sendOutbound'] {
  return async (command) => {
    const persisted = await handle.db.transaction((tx) =>
      createPersistOutboundMessage({
        conversations: createConversationRepository(tx),
        messages: createMessageRepository(tx),
        events: createOutboxEventBus(tx),
        generateId,
        now: systemClock,
      })(command),
    );
    triggerDrain();
    if (!persisted.ok) return persisted;

    // deliver นอก tx (network) — ล้ม → deliver service mark 'failed' + publish outbound_message.failed
    // (event เขียน outbox บน pool = single insert atomic) แล้ว drain ให้ agent เห็นสถานะ realtime
    const delivered = await createDeliverOutboundMessage({
      outbound,
      messages: createMessageRepository(handle.db),
      events: createOutboxEventBus(handle.db),
      now: systemClock,
    })(persisted.value.message);
    if (!delivered.ok) triggerDrain();
    return delivered;
  };
}

/**
 * ประกอบ updateContactName — backfill ชื่อ contact + broadcast conversation.updated (inbox refresh ชื่อ realtime)
 * ใช้ tx เดียว (update + publish atomic) แล้ว triggerDrain · แยก helper กัน God function ใน createContainer
 */
function buildUpdateContactName(
  handle: DbHandle,
  triggerDrain: () => void,
): AppDeps['updateContactName'] {
  return async (workspaceId, contactId, conversationId, displayName) => {
    await handle.db.transaction(async (tx) => {
      await createContactRepository(tx).updateDisplayName(workspaceId, contactId, displayName);
      await createOutboxEventBus(tx).publish({
        type: 'conversation.updated',
        workspaceId,
        conversationId,
        occurredAt: systemClock(),
      });
    });
    triggerDrain();
  };
}

/**
 * ประกอบ manageConversation — assign/unassign/close/reopen/assignBot/escalate (Phase 4 routing + Phase 5 bot)
 * แต่ละ op รันใน tx (conversation repo + outbox eventbus ผูก tx เดียว → atomic) แล้ว `triggerDrain()` หลัง commit
 * → agent เห็น badge/สถานะ sync realtime · `run` combinator กัน boilerplate ซ้ำ + คุม God function ใน createContainer
 */
function buildManageConversation(handle: DbHandle, triggerDrain: () => void): ManageConversation {
  const txManage = <T>(op: (m: ManageConversation) => Promise<T>): Promise<T> =>
    handle.db.transaction((tx) =>
      op(
        createManageConversation({
          conversations: createConversationRepository(tx),
          events: createOutboxEventBus(tx),
          now: systemClock,
        }),
      ),
    );
  const run =
    <C, R>(pick: (m: ManageConversation) => (cmd: C) => Promise<R>) =>
    async (cmd: C): Promise<R> => {
      const r = await txManage((m) => pick(m)(cmd));
      triggerDrain();
      return r;
    };
  return {
    assign: run((m) => m.assign),
    unassign: run((m) => m.unassign),
    close: run((m) => m.close),
    reopen: run((m) => m.reopen),
    assignBot: run((m) => m.assignBot),
    escalate: run((m) => m.escalate),
  };
}

/**
 * ประกอบ bot consumer (Phase 5) — subscribe outbox ด้วย cursor 'bot' (additive · ไม่แตะ agent WS consumer)
 * bot ตอบตาม rules ที่ workspace เปิดใช้ · reuse sendOutbound (persist→deliver→realtime) + manageConversation
 * แยก helper กัน God function ใน createContainer (bot repos ผูก pool — อ่านล้วน, write path เปิด tx เอง)
 */
function buildBotConsumer(
  handle: DbHandle,
  conversations: ConversationRepository,
  inboxRead: InboxReadRepository,
  sendOutbound: AppDeps['sendOutbound'],
  manageConversation: ManageConversation,
): () => Promise<number> {
  const cursorStore = createOutboxCursorStore(handle.db);
  const botRules = createBotRuleRepository(handle.db);
  const botConfig = createWorkspaceBotConfigRepository(handle.db);
  return createBotConsumer({
    claimBatch: (limit) => cursorStore.claimBatch('bot', limit),
    isBotEnabled: async (ws) => (await botConfig.get(ws))?.botEnabled ?? false,
    listRules: (ws, channelId) => botRules.listEnabled(ws, channelId),
    getConversation: (ws, conv) => conversations.findById(ws, conv),
    getMessage: (ws, msgId) => inboxRead.getMessageById(ws, msgId),
    sendOutbound,
    manage: manageConversation,
  });
}

/**
 * Composition root จริง — ต่อ DB + repos + services + WS registry + outbound gateway + outbox realtime
 * จุดเดียวที่ adapter (db, channel-web) มาเจอกัน (structural typing bridge resolver ↔ gateway)
 *
 * Transactional outbox: ingest/sendOutbound รันใน `db.transaction` โดย repos + outbox eventbus ผูก tx เดียวกัน
 * → business write + event เขียน atomic · หลัง commit เรียก immediate drain (realtime) · pg-boss relay = safety net
 */
export function createContainer(config: ContainerConfig): Container {
  const handle = createDb(config.databaseUrl);
  const registry = createConnectionRegistry();
  const agentRegistry = createConnectionRegistry();
  const generateId = createIdGenerator();

  // repos แบบ pool (อ่าน) — write path สร้าง repo ผูก tx เองตอนรัน
  const channels = createChannelRepository(handle.db);
  const conversations = createConversationRepository(handle.db);
  const agents = createAgentRepository(handle.db);
  const inboxRead = createInboxReadRepository(handle.db);

  // channel IO (credential resolver + outbound gateway ต่อช่องทาง + dispatcher) — ประกอบแยกกัน God function
  const { outbound, lineCredentials, lineProfile } = buildChannelIo(
    handle,
    registry,
    channels,
    config.channelEncryptionKey,
    config.lineFetch,
  );

  // Outbox consumer — fan-out event เข้า agent WS (drain ใน tx: fetch SKIP LOCKED → send → mark)
  const drain = createOutboxConsumer({
    withOutboxTx: (run) => handle.db.transaction((tx) => run(createOutboxStore(tx))),
    getMessage: (workspaceId, messageId) => inboxRead.getMessageById(workspaceId, messageId),
    getConversation: (workspaceId, conversationId) =>
      inboxRead.getConversationListItem(workspaceId, conversationId),
    agentRegistry,
    now: systemClock,
  });
  // เก็บ drain ล่าสุดไว้ให้ close() รอจบก่อนปิด pool (กัน "use pool after end" ตอน shutdown/test teardown)
  let inFlightDrain: Promise<unknown> = Promise.resolve();
  const triggerDrain = (): void => {
    // fire-and-forget (ไม่บล็อก response) · realtime สำหรับ single-instance
    inFlightDrain = drain().catch((error) => {
      console.error('outbox drain error:', error instanceof Error ? error.message : error);
    });
  };

  // send outbound = persist(tx) → deliver(นอก tx) — แยกเป็น helper กัน God function (buildSendOutbound)
  const sendOutbound = buildSendOutbound(handle, outbound, generateId, triggerDrain);

  // manage conversation (assign/unassign/close/reopen/assignBot/escalate) — tx + outbox + triggerDrain (แยก helper)
  const manageConversation = buildManageConversation(handle, triggerDrain);

  // Bot consumer (Phase 5) — cursor 'bot' ของตัวเอง · reuse sendOutbound/manageConversation ที่ประกอบข้างบน
  const drainBot = buildBotConsumer(
    handle,
    conversations,
    inboxRead,
    sendOutbound,
    manageConversation,
  );
  let inFlightBotDrain: Promise<unknown> = Promise.resolve();
  const triggerBotDrain = (): void => {
    // fire-and-forget เหมือน triggerDrain · consumer แยก cursor → trigger คู่กับ agent drain ได้
    inFlightBotDrain = drainBot().catch((error) => {
      console.error('bot drain error:', error instanceof Error ? error.message : error);
    });
  };

  // ingest inbound — เขียน contact/conversation/message + outbox ใน tx เดียว แล้ว trigger agent + bot drain
  const ingest: AppDeps['ingest'] = async (command) => {
    const result = await handle.db.transaction((tx) =>
      createIngestInboundMessage({
        contacts: createContactRepository(tx),
        conversations: createConversationRepository(tx),
        messages: createMessageRepository(tx),
        events: createOutboxEventBus(tx),
        generateId,
        now: systemClock,
      })(command),
    );
    triggerDrain(); // agent WS realtime (processed_at)
    triggerBotDrain(); // bot automation (cursor 'bot') — สายใหม่ตอบเอง/escalate
    return result;
  };

  const updateContactName = buildUpdateContactName(handle, triggerDrain);

  const auth = createAuthService({
    agents,
    secret: config.authSecret,
    tokenTtlSec: config.tokenTtlSec ?? DEFAULT_TOKEN_TTL_SEC,
  });

  const session: AppDeps['session'] = {
    cookieName: 'session',
    secure: config.cookieSecure ?? true,
    maxAgeSec: config.tokenTtlSec ?? DEFAULT_TOKEN_TTL_SEC,
    allowedOrigins: config.allowedOrigins ?? [],
  };

  const relay = createOutboxRelay(config.databaseUrl, drain);

  const deps: AppDeps = {
    channels,
    ingest,
    sendOutbound,
    registry,
    agentRegistry,
    inboxRead,
    conversations,
    manageConversation,
    auth,
    session,
    newSessionId: () => `web_${randomUUID()}`,
    lineCredentials,
    lineProfile,
    updateContactName,
  };

  return {
    deps,
    start: () => relay.start(),
    close: async () => {
      await relay.stop();
      await inFlightDrain; // รอ agent drain ที่ค้างให้จบก่อนปิด pool
      await inFlightBotDrain; // รอ bot drain ที่ค้าง (กัน "use pool after end")
      await handle.close();
    },
  };
}
