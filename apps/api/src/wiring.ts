import { randomUUID } from 'node:crypto';
import {
  createIngestInboundMessage,
  createManageConversation,
  createSendOutboundMessage,
} from '@omni/domain';
import type { ChannelRepository, ManageConversation, OutboundGateway } from '@omni/domain';
import {
  createAgentRepository,
  createChannelCredentialRepository,
  createChannelRepository,
  createContactRepository,
  createConversationRepository,
  createDb,
  createIdGenerator,
  createInboxReadRepository,
  createMessageRepository,
  createOutboxEventBus,
  createOutboxStore,
  createWebRouteResolver,
  loadEncryptionKey,
  systemClock,
} from '@omni/db';
import type { DbHandle } from '@omni/db';
import { createWebOutboundGateway } from '@omni/channel-web';
import {
  createLineCredentialResolver,
  createLineHttpPushClient,
  createLineOutboundGateway,
} from '@omni/channel-line';
import type { LineCredentialResolver } from '@omni/channel-line';
import type { AppDeps } from './deps';
import { createAuthService } from './auth/service';
import { createDispatchOutboundGateway } from './outbound-dispatch';
import { createConnectionRegistry } from './registry';
import type { ConnectionRegistry } from './registry';
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
): { outbound: OutboundGateway; lineCredentials: LineCredentialResolver } {
  const routeResolver = createWebRouteResolver(handle.db);

  const encryptionKey = loadEncryptionKey(channelEncryptionKey ?? DEV_CHANNEL_ENCRYPTION_KEY);
  const channelCredentials = createChannelCredentialRepository(handle.db, encryptionKey);
  const lineCredentials = createLineCredentialResolver((workspaceId, channelId) =>
    channelCredentials.get(workspaceId, channelId),
  );

  const webOutbound = createWebOutboundGateway({ registry, resolveRoute: routeResolver });
  const lineOutbound = createLineOutboundGateway({
    resolveRoute: routeResolver,
    resolveCredentials: lineCredentials,
    push: createLineHttpPushClient(),
  });
  const outbound = createDispatchOutboundGateway({
    resolveChannelType: async (message) => {
      const channel = await channels.findPublicById(message.channelId);
      return channel && channel.workspaceId === message.workspaceId ? channel.type : null;
    },
    byType: { web: webOutbound, line: lineOutbound },
  });

  return { outbound, lineCredentials };
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
  const { outbound, lineCredentials } = buildChannelIo(
    handle,
    registry,
    channels,
    config.channelEncryptionKey,
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

  // ingest inbound — เขียน contact/conversation/message + outbox ใน tx เดียว แล้ว trigger drain
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
    triggerDrain();
    return result;
  };

  // send outbound — persist message + outbox + push ช่องทาง (web) ใน tx เดียว แล้ว trigger drain
  // ⚠️ MVP: gateway.send (push widget WS local) รันใน tx ด้วย — เมื่อมี provider ช่องทางไกล (Phase 4) ค่อยแยก persist/deliver
  const sendOutbound: AppDeps['sendOutbound'] = async (command) => {
    const result = await handle.db.transaction((tx) =>
      createSendOutboundMessage({
        conversations: createConversationRepository(tx),
        messages: createMessageRepository(tx),
        outbound,
        events: createOutboxEventBus(tx),
        generateId,
        now: systemClock,
      })(command),
    );
    triggerDrain();
    return result;
  };

  // manage conversation (assign/unassign/close/reopen) — รันใน tx + outbox eventbus แล้ว trigger drain
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
  const manageConversation: ManageConversation = {
    assign: async (cmd) => {
      const r = await txManage((m) => m.assign(cmd));
      triggerDrain();
      return r;
    },
    unassign: async (cmd) => {
      const r = await txManage((m) => m.unassign(cmd));
      triggerDrain();
      return r;
    },
    close: async (cmd) => {
      const r = await txManage((m) => m.close(cmd));
      triggerDrain();
      return r;
    },
    reopen: async (cmd) => {
      const r = await txManage((m) => m.reopen(cmd));
      triggerDrain();
      return r;
    },
  };

  const auth = createAuthService({
    agents,
    secret: config.authSecret,
    tokenTtlSec: config.tokenTtlSec ?? DEFAULT_TOKEN_TTL_SEC,
  });

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
    newSessionId: () => `web_${randomUUID()}`,
    lineCredentials,
  };

  return {
    deps,
    start: () => relay.start(),
    close: async () => {
      await relay.stop();
      await inFlightDrain; // รอ drain ที่ค้างให้จบก่อนปิด pool
      await handle.close();
    },
  };
}
