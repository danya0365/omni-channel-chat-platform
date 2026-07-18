// Widget transport core — คุยกับ apps/api ผ่าน HTTP (inbound) + WebSocket (outbound realtime)
// แยกจาก DOM (main.ts) เพื่อ test ได้: inject fetch/WebSocket/storage → unit test ด้วย fake, e2e ด้วย global จริง
// แชร์ shape ของ event จาก unified schema (@omni/channel-web) ด้วย import type — ห้าม redefine

import type { WebMessageEvent } from '@omni/channel-web';

/** สถานะการเชื่อม WS (ใช้โชว์ indicator บน UI) */
export type WidgetStatus = 'connecting' | 'online' | 'offline';

/** ผลลัพธ์ของ POST inbound message */
export interface SendResult {
  conversationId: string;
  messageId: string;
  at: string;
}

/** localStorage-like — inject ได้เพื่อ test / รันนอก browser */
export interface WidgetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** fetch แบบแคบ (พอสำหรับ widget) — global fetch ของ browser/node เข้ากันได้ */
type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** WebSocket แบบแคบ — global WebSocket ของ browser/node เข้ากันได้ (cast ที่ default) */
export interface WidgetSocket {
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}
export type WidgetSocketCtor = new (url: string) => WidgetSocket;

export interface WidgetClientConfig {
  /** base URL ของ apps/api เช่น http://localhost:3001 */
  apiOrigin: string;
  /** public channel identifier (web channel) */
  channelId: string;
  /** callback เมื่อได้ event จาก WS (outbound ของ agent/bot) */
  onMessage: (event: WebMessageEvent) => void;
  /** callback สถานะการเชื่อม (optional) */
  onStatus?: (status: WidgetStatus) => void;
  // ---- inject ได้ (default = global ของ browser) ----
  fetchFn?: FetchLike;
  WebSocketCtor?: WidgetSocketCtor;
  storage?: WidgetStorage;
  /** backoff เริ่มต้นของ reconnect (ms) — override ใน test ให้เร็ว */
  reconnectBaseMs?: number;
  /** backoff สูงสุด (ms) */
  reconnectMaxMs?: number;
}

export interface WidgetClient {
  /** bootstrap session + เชื่อม WS */
  start(): Promise<void>;
  /** ส่งข้อความ inbound → คืนผลลัพธ์จาก api (throw ถ้าไม่ 2xx) */
  sendText(text: string): Promise<SendResult>;
  /** ปิด WS + หยุด reconnect */
  stop(): void;
  /** sessionId ปัจจุบัน (null ถ้ายังไม่ bootstrap) */
  sessionId(): string | null;
}

/** storage เริ่มต้น: localStorage ถ้ามี · ไม่มี (SSR/node) → in-memory */
function defaultStorage(): WidgetStorage {
  if (typeof localStorage !== 'undefined') return localStorage;
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
  };
}

/** parse ข้อมูลดิบจาก WS → WebMessageEvent (null ถ้า malformed/ไม่ใช่ message) */
function parseEvent(raw: unknown): WebMessageEvent | null {
  if (typeof raw !== 'string') return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (
      obj !== null &&
      typeof obj === 'object' &&
      (obj as { type?: unknown }).type === 'message' &&
      typeof (obj as { at?: unknown }).at === 'string'
    ) {
      return obj as WebMessageEvent;
    }
  } catch {
    // malformed JSON — ข้าม (อย่าให้ crash widget)
  }
  return null;
}

export function createWidgetClient(config: WidgetClientConfig): WidgetClient {
  const fetchFn: FetchLike = config.fetchFn ?? (globalThis.fetch as unknown as FetchLike);
  const WsCtor: WidgetSocketCtor =
    config.WebSocketCtor ?? (globalThis.WebSocket as unknown as WidgetSocketCtor);
  const storage = config.storage ?? defaultStorage();
  const base = config.apiOrigin.replace(/\/+$/, '');
  const channelPath = `/channels/web/${config.channelId}`;
  const storageKey = `omni_session_${config.channelId}`;
  const reconnectBaseMs = config.reconnectBaseMs ?? 1000;
  const reconnectMaxMs = config.reconnectMaxMs ?? 15000;

  let session: string | null = storage.getItem(storageKey);
  let socket: WidgetSocket | null = null;
  let stopped = false;
  let attempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (s: WidgetStatus): void => config.onStatus?.(s);

  /** มี session แล้วคืนเลย · ไม่มี → mint ผ่าน POST sessions แล้ว persist */
  async function ensureSession(): Promise<string> {
    if (session) return session;
    const res = await fetchFn(`${base}${channelPath}/sessions`, { method: 'POST' });
    if (!res.ok) throw new Error(`session bootstrap failed: ${res.status}`);
    const data = (await res.json()) as { sessionId: string };
    session = data.sessionId;
    storage.setItem(storageKey, session);
    return session;
  }

  function wsUrl(sid: string): string {
    const u = new URL(`${base}${channelPath}/ws`);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.searchParams.set('sessionId', sid);
    return u.toString();
  }

  function scheduleReconnect(sid: string): void {
    if (stopped) return;
    const delay = Math.min(reconnectBaseMs * 2 ** attempts, reconnectMaxMs);
    attempts += 1;
    reconnectTimer = setTimeout(() => connect(sid), delay);
  }

  function connect(sid: string): void {
    if (stopped) return;
    setStatus('connecting');
    const ws = new WsCtor(wsUrl(sid));
    socket = ws;
    ws.onopen = () => {
      attempts = 0;
      setStatus('online');
    };
    ws.onmessage = (ev) => {
      const event = parseEvent(ev.data);
      if (event) config.onMessage(event);
    };
    ws.onclose = () => {
      if (socket === ws) socket = null;
      setStatus('offline');
      scheduleReconnect(sid);
    };
    ws.onerror = () => {
      // onclose จะตามมาเอง → reconnect ที่นั่น (กัน schedule ซ้ำ)
    };
  }

  return {
    async start() {
      const sid = await ensureSession();
      connect(sid);
    },
    async sendText(text) {
      const sid = await ensureSession();
      const res = await fetchFn(`${base}${channelPath}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, text }),
      });
      if (!res.ok) throw new Error(`send failed: ${res.status}`);
      return (await res.json()) as SendResult;
    },
    stop() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      socket?.close();
      socket = null;
    },
    sessionId: () => session,
  };
}
