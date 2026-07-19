import type {
  Clock,
  ConversationId,
  ConversationListItem,
  Message,
  MessageId,
  WorkspaceId,
} from '@omni/domain';
import type { OutboxStore } from '@omni/db';
import type { ConnectionRegistry } from '../registry';
import { toAgentConversationEvent, toAgentMessageEvent } from './agent-events';

export interface OutboxConsumerDeps {
  /**
   * เปิด transaction แล้วส่ง OutboxStore ที่ผูก tx เข้า callback
   * (fetchUnprocessed ใช้ FOR UPDATE SKIP LOCKED + markProcessed อยู่ tx เดียวกัน → concurrency-safe)
   */
  withOutboxTx<T>(run: (store: OutboxStore) => Promise<T>): Promise<T>;
  /** อ่าน message รายตัว (ประกอบ message event) */
  getMessage(workspaceId: WorkspaceId, messageId: MessageId): Promise<Message | null>;
  /** อ่าน conversation list-item (ประกอบ conversation event — Phase 4 routing) */
  getConversation(
    workspaceId: WorkspaceId,
    conversationId: ConversationId,
  ): Promise<ConversationListItem | null>;
  /** registry ของ agent — fan-out ตาม workspaceId */
  agentRegistry: Pick<ConnectionRegistry, 'send'>;
  now: Clock;
  batchSize?: number;
}

const DEFAULT_BATCH = 50;

/**
 * Outbox consumer — `drain()`: อ่าน event ที่ยังไม่ processed → fan-out เข้า agent WS ของ workspace → mark processed
 * เรียกได้ทั้ง immediate (หลัง business tx commit → realtime) และ pg-boss relay (safety net / durability)
 * idempotent + concurrency-safe (SKIP LOCKED) · คืนจำนวน event ที่ fan-out จริง
 */
export function createOutboxConsumer(deps: OutboxConsumerDeps) {
  const batchSize = deps.batchSize ?? DEFAULT_BATCH;

  return async function drain(): Promise<number> {
    return deps.withOutboxTx(async (store) => {
      const rows = await store.fetchUnprocessed(batchSize);
      if (rows.length === 0) return 0;

      const processedIds: string[] = [];
      let fanned = 0;
      for (const row of rows) {
        processedIds.push(row.id);
        const workspaceId = row.payload.workspaceId;
        if (typeof workspaceId !== 'string') continue;

        if (row.type === 'conversation.updated') {
          // conversation event — re-fetch list-item แล้ว push ให้ agent merge (assignee/status)
          const conversationId = row.payload.conversationId;
          if (typeof conversationId !== 'string') continue;
          const item = await deps.getConversation(
            workspaceId as WorkspaceId,
            conversationId as ConversationId,
          );
          if (!item) continue;
          deps.agentRegistry.send(workspaceId, JSON.stringify(toAgentConversationEvent(item)));
          fanned += 1;
        } else {
          // message event — re-fetch message แล้ว push
          const messageId = row.payload.messageId;
          if (typeof messageId !== 'string') continue;
          const message = await deps.getMessage(workspaceId as WorkspaceId, messageId as MessageId);
          if (!message) continue;
          deps.agentRegistry.send(workspaceId, JSON.stringify(toAgentMessageEvent(message)));
          fanned += 1;
        }
      }
      // mark ทุก row ที่หยิบมา (แม้ประกอบ event ไม่ได้ก็ถือว่า consumed — กันวนซ้ำ)
      await store.markProcessed(processedIds, deps.now());
      return fanned;
    });
  };
}
