import type { Clock, Message, MessageId, WorkspaceId } from '@omni/domain';
import type { OutboxStore } from '@omni/db';
import type { ConnectionRegistry } from '../registry';
import { toAgentMessageEvent } from './agent-events';

export interface OutboxConsumerDeps {
  /**
   * เปิด transaction แล้วส่ง OutboxStore ที่ผูก tx เข้า callback
   * (fetchUnprocessed ใช้ FOR UPDATE SKIP LOCKED + markProcessed อยู่ tx เดียวกัน → concurrency-safe)
   */
  withOutboxTx<T>(run: (store: OutboxStore) => Promise<T>): Promise<T>;
  /** อ่าน message รายตัว (ประกอบ event ก่อน fan-out) */
  getMessage(workspaceId: WorkspaceId, messageId: MessageId): Promise<Message | null>;
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
        const messageId = row.payload.messageId;
        if (typeof workspaceId !== 'string' || typeof messageId !== 'string') continue;

        const message = await deps.getMessage(workspaceId as WorkspaceId, messageId as MessageId);
        if (!message) continue;
        deps.agentRegistry.send(workspaceId, JSON.stringify(toAgentMessageEvent(message)));
        fanned += 1;
      }
      // mark ทุก row ที่หยิบมา (แม้ประกอบ event ไม่ได้ก็ถือว่า consumed — กันวนซ้ำ)
      await store.markProcessed(processedIds, deps.now());
      return fanned;
    });
  };
}
