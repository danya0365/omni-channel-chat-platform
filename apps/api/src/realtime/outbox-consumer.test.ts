import { describe, expect, it } from 'vitest';
import type { Message, MessageId, WorkspaceId } from '@omni/domain';
import type { OutboxRow, OutboxStore } from '@omni/db';
import { createOutboxConsumer } from './outbox-consumer';

const NOW = new Date(Date.UTC(2026, 0, 2));

const cannedMessage: Message = {
  id: 'msg_1',
  workspaceId: 'ws_1',
  conversationId: 'conv_1',
  channelId: 'chn_web',
  direction: 'inbound',
  sender: { kind: 'contact', contactId: 'ctc_1' },
  content: { type: 'text', text: 'สวัสดี' },
  status: 'received',
  externalId: null,
  createdAt: new Date(Date.UTC(2026, 0, 1)),
};

const outboxRow = (id: string): OutboxRow => ({
  id,
  type: 'inbound_message.received',
  payload: {
    workspaceId: 'ws_1',
    messageId: 'msg_1',
    conversationId: 'conv_1',
    occurredAt: '2026-01-01T00:00:00.000Z',
  },
  occurredAt: new Date(Date.UTC(2026, 0, 1)),
});

/** OutboxStore ปลอม (in-memory) — fetch ข้าม row ที่ mark แล้ว */
function fakeStore(rows: OutboxRow[]) {
  const state = { processed: [] as string[] };
  const store: OutboxStore = {
    fetchUnprocessed: async (limit) =>
      rows.filter((r) => !state.processed.includes(r.id)).slice(0, limit),
    markProcessed: async (ids) => {
      state.processed.push(...ids);
    },
  };
  return { store, state };
}

function makeConsumer(
  rows: OutboxRow[],
  getMessage: (w: WorkspaceId, m: MessageId) => Promise<Message | null> = async () => cannedMessage,
) {
  const { store, state } = fakeStore(rows);
  const sent: Array<{ key: string; data: string }> = [];
  const drain = createOutboxConsumer({
    withOutboxTx: (run) => run(store),
    getMessage,
    agentRegistry: {
      send: (key, data) => {
        sent.push({ key, data });
        return 1;
      },
    },
    now: () => NOW,
  });
  return { drain, sent, state };
}

describe('outbox consumer drain', () => {
  it('fan-out event เข้า agentRegistry ตาม workspaceId + mark processed', async () => {
    const { drain, sent, state } = makeConsumer([outboxRow('o1')]);
    const n = await drain();

    expect(n).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.key).toBe('ws_1');
    expect(JSON.parse(sent[0]?.data ?? '{}')).toMatchObject({
      type: 'message',
      conversationId: 'conv_1',
      message: { id: 'msg_1', content: { type: 'text', text: 'สวัสดี' } },
    });
    expect(state.processed).toEqual(['o1']);
  });

  it('ไม่มี unprocessed → 0 · ไม่ fan-out', async () => {
    const { drain, sent } = makeConsumer([]);
    expect(await drain()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('drain ซ้ำ → row ที่ processed แล้วไม่ถูกส่งอีก', async () => {
    const { drain, sent } = makeConsumer([outboxRow('o1')]);
    await drain();
    expect(await drain()).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('getMessage คืน null → ไม่ fan-out แต่ mark processed (กันวนซ้ำ)', async () => {
    const { drain, sent, state } = makeConsumer([outboxRow('o1')], async () => null);
    expect(await drain()).toBe(0);
    expect(sent).toHaveLength(0);
    expect(state.processed).toEqual(['o1']);
  });
});
