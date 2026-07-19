import { randomUUID } from 'node:crypto';
import { createIngestInboundMessage, createSendOutboundMessage } from '@omni/domain';
import {
  createAgentRepository,
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
  systemClock,
} from '@omni/db';
import { createWebOutboundGateway } from '@omni/channel-web';
import type { AppDeps } from './deps';
import { createAuthService } from './auth/service';
import { createConnectionRegistry } from './registry';
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
  /** อายุ token (วินาที) — default 12 ชม. */
  tokenTtlSec?: number;
}

const DEFAULT_TOKEN_TTL_SEC = 12 * 60 * 60;

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

  const outbound = createWebOutboundGateway({
    registry,
    resolveRoute: createWebRouteResolver(handle.db),
  });

  // Outbox consumer — fan-out event เข้า agent WS (drain ใน tx: fetch SKIP LOCKED → send → mark)
  const drain = createOutboxConsumer({
    withOutboxTx: (run) => handle.db.transaction((tx) => run(createOutboxStore(tx))),
    getMessage: (workspaceId, messageId) => inboxRead.getMessageById(workspaceId, messageId),
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
    auth,
    newSessionId: () => `web_${randomUUID()}`,
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
