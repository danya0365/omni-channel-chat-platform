import { afterEach, describe, expect, it } from 'vitest';
import {
  createWidgetClient,
  type WidgetClient,
  type WidgetSocket,
  type WidgetSocketCtor,
  type WidgetStatus,
} from './client';

const CHANNEL_ID = 'chn_web_demo';
const API = 'http://localhost:3001';
const STORAGE_KEY = `omni_session_${CHANNEL_ID}`;

const OUTBOUND_EVENT = {
  type: 'message',
  messageId: 'msg_out',
  conversationId: 'conv_1',
  direction: 'outbound',
  content: { type: 'text', text: 'ได้เลยครับ' },
  sender: { kind: 'bot' },
  at: '2026-01-01T00:00:00.000Z',
};

/** WebSocket ปลอม — ยิง lifecycle เองผ่าน handler ตรงๆ (onopen/onmessage/onclose) */
interface TestSocket extends WidgetSocket {
  url: string;
  closed: boolean;
}

/** สร้าง ctor ที่ push socket ทุกตัวลง `sockets` ของเทสต์นั้น (แยก state ต่อเทสต์ ไม่แชร์ static) */
function socketCtor(sockets: TestSocket[]): WidgetSocketCtor {
  return class implements TestSocket {
    readonly url: string;
    closed = false;
    onopen: ((ev: unknown) => void) | null = null;
    onmessage: ((ev: { data: unknown }) => void) | null = null;
    onclose: ((ev: unknown) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    constructor(url: string) {
      this.url = url;
      sockets.push(this);
    }
    close(): void {
      this.closed = true;
      this.onclose?.({});
    }
  };
}

interface FetchCall {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}

/** fetch ปลอม — route ตาม suffix ของ path, บันทึกทุก call */
function makeFetch() {
  const calls: FetchCall[] = [];
  const fn = async (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => {
    calls.push({ url, init });
    const json = async (): Promise<unknown> => {
      if (url.endsWith('/sessions')) return { sessionId: 'web_fake_1', channelId: CHANNEL_ID };
      if (url.endsWith('/messages'))
        return { conversationId: 'conv_1', messageId: 'msg_1', at: OUTBOUND_EVENT.at };
      throw new Error(`unexpected url ${url}`);
    };
    return { ok: true, status: 200, json };
  };
  return { fn, calls };
}

function makeStorage(preset?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(preset ?? {}));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

async function waitFor(cond: () => boolean, timeoutMs = 500): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 5));
  }
}

// stop ทุก client ท้ายเทสต์ → เคลียร์ reconnect timer ไม่ให้ค้างข้ามเทสต์ (กัน flaky)
const activeClients: WidgetClient[] = [];
afterEach(() => {
  activeClients.forEach((c) => c.stop());
  activeClients.length = 0;
});

function setup(opts: { preset?: Record<string, string> } = {}) {
  const sockets: TestSocket[] = [];
  const fetchStub = makeFetch();
  const storage = makeStorage(opts.preset);
  const received: unknown[] = [];
  const statuses: WidgetStatus[] = [];
  const client = createWidgetClient({
    apiOrigin: API,
    channelId: CHANNEL_ID,
    fetchFn: fetchStub.fn,
    WebSocketCtor: socketCtor(sockets),
    storage,
    reconnectBaseMs: 5,
    onMessage: (e) => received.push(e),
    onStatus: (s) => statuses.push(s),
  });
  activeClients.push(client);
  return { client, fetchStub, storage, received, statuses, sockets };
}

describe('createWidgetClient', () => {
  it('bootstrap: ไม่มี session → POST /sessions, เก็บลง storage, เชื่อม WS ด้วย sessionId', async () => {
    const { client, fetchStub, storage, sockets } = setup();
    await client.start();

    expect(fetchStub.calls.some((c) => c.url.endsWith('/sessions'))).toBe(true);
    expect(client.sessionId()).toBe('web_fake_1');
    expect(storage.map.get(STORAGE_KEY)).toBe('web_fake_1');
    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.url).toBe(
      `ws://localhost:3001/channels/web/${CHANNEL_ID}/ws?sessionId=web_fake_1`,
    );
  });

  it('มี session cache แล้ว → ไม่ POST /sessions ซ้ำ, ใช้ session เดิมต่อ WS', async () => {
    const { client, fetchStub, sockets } = setup({ preset: { [STORAGE_KEY]: 'cached_sess' } });
    await client.start();

    expect(fetchStub.calls.some((c) => c.url.endsWith('/sessions'))).toBe(false);
    expect(client.sessionId()).toBe('cached_sess');
    expect(sockets[0]?.url).toContain('sessionId=cached_sess');
  });

  it('sendText → POST /messages พร้อม sessionId+text แล้วคืน SendResult', async () => {
    const { client, fetchStub } = setup();
    await client.start();
    const res = await client.sendText('สวัสดีครับ');

    const msgCall = fetchStub.calls.find((c) => c.url.endsWith('/messages'));
    expect(msgCall?.init?.method).toBe('POST');
    expect(JSON.parse(msgCall?.init?.body ?? '{}')).toEqual({
      sessionId: 'web_fake_1',
      text: 'สวัสดีครับ',
    });
    expect(res).toEqual({ conversationId: 'conv_1', messageId: 'msg_1', at: OUTBOUND_EVENT.at });
  });

  it('sendText ก่อน start → bootstrap session เองอัตโนมัติ', async () => {
    const { client, fetchStub } = setup();
    await client.sendText('hi');
    expect(fetchStub.calls.some((c) => c.url.endsWith('/sessions'))).toBe(true);
    expect(client.sessionId()).toBe('web_fake_1');
  });

  it('onMessage: event ถูกต้อง → เรียก callback · malformed/ไม่ใช่ message → ข้าม', async () => {
    const { client, received, sockets } = setup();
    await client.start();
    const socket = sockets[0];

    socket?.onmessage?.({ data: JSON.stringify(OUTBOUND_EVENT) });
    socket?.onmessage?.({ data: 'ไม่ใช่ json' });
    socket?.onmessage?.({ data: JSON.stringify({ type: 'other' }) });
    socket?.onmessage?.({ data: 42 });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ direction: 'outbound', content: { text: 'ได้เลยครับ' } });
  });

  it('status: connecting → online (onopen) → offline (onclose)', async () => {
    const { client, statuses, sockets } = setup();
    await client.start();
    expect(statuses).toContain('connecting');

    sockets[0]?.onopen?.({});
    expect(statuses).toContain('online');

    sockets[0]?.onclose?.({});
    expect(statuses).toContain('offline');
  });

  it('reconnect: WS หลุด → เปิด socket ใหม่อัตโนมัติ (backoff)', async () => {
    const { client, sockets } = setup();
    await client.start();
    expect(sockets).toHaveLength(1);

    sockets[0]?.onclose?.({});
    await waitFor(() => sockets.length === 2);
    expect(sockets[1]?.url).toContain('sessionId=web_fake_1');
  });

  it('stop: ปิด socket + ไม่ reconnect อีก', async () => {
    const { client, sockets } = setup();
    await client.start();
    client.stop();

    expect(sockets[0]?.closed).toBe(true);
    // รอเผื่อ reconnect timer ยิง — ต้องไม่มี socket ใหม่
    await new Promise((r) => setTimeout(r, 30));
    expect(sockets).toHaveLength(1);
  });
});
