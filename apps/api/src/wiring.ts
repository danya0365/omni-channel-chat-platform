import { randomUUID } from 'node:crypto';
import { createIngestInboundMessage, createSendOutboundMessage } from '@omni/domain';
import type { EventBus } from '@omni/domain';
import {
  createChannelRepository,
  createContactRepository,
  createConversationRepository,
  createDb,
  createIdGenerator,
  createMessageRepository,
  createWebRouteResolver,
  systemClock,
} from '@omni/db';
import { createWebOutboundGateway } from '@omni/channel-web';
import type { AppDeps } from './deps';
import { createConnectionRegistry } from './registry';

export interface Container {
  deps: AppDeps;
  /** ปิด DB pool ตอน shutdown */
  close: () => Promise<void>;
}

/**
 * Composition root จริง — ต่อ DB + repos + services + WS registry + outbound gateway เข้าด้วยกัน
 * จุดเดียวที่ adapter (db, channel-web) มาเจอกัน (structural typing bridge resolver ↔ gateway)
 */
export function createContainer(databaseUrl: string): Container {
  const handle = createDb(databaseUrl);
  const registry = createConnectionRegistry();
  const generateId = createIdGenerator();

  const channels = createChannelRepository(handle.db);
  const contacts = createContactRepository(handle.db);
  const conversations = createConversationRepository(handle.db);
  const messages = createMessageRepository(handle.db);

  // EventBus แบบ in-process no-op (seam) — outbox/pg-boss + consumer (agent inbox realtime) มาใน phase ถัดไป
  const events: EventBus = { publish: async () => {} };

  const ingest = createIngestInboundMessage({
    contacts,
    conversations,
    messages,
    events,
    generateId,
    now: systemClock,
  });

  const outbound = createWebOutboundGateway({
    registry,
    resolveRoute: createWebRouteResolver(handle.db),
  });

  const sendOutbound = createSendOutboundMessage({
    conversations,
    messages,
    outbound,
    generateId,
    now: systemClock,
  });

  const deps: AppDeps = {
    channels,
    ingest,
    sendOutbound,
    registry,
    newSessionId: () => `web_${randomUUID()}`,
  };

  return { deps, close: () => handle.close() };
}
