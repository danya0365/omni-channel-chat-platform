// API client ของ inbox — คุย apps/api ผ่าน HTTP + WS · auth = **httpOnly cookie** (ADR-0005)
// ไม่มี token ฝั่ง client — ทุก request ใช้ `credentials: 'include'` ให้ browser แนบ cookie อัตโนมัติ

import type {
  AuthAgent,
  ConversationPatch,
  Session,
  WireConversation,
  WireMessage,
} from '../domain/types';

export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:3001';

/** ws:// หรือ wss:// ตาม origin ของ api · cookie แนบกับ WS handshake อัตโนมัติ (same-site) — ไม่มี token ใน URL */
export function inboxWsUrl(): string {
  return `${API_ORIGIN.replace(/^http/, 'ws')}/inbox/ws`;
}

/** error ที่รู้ว่า session หมดอายุ/ไม่ผ่าน (caller → logout) */
export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

async function authedGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_ORIGIN}${path}`, { credentials: 'include' });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function login(email: string, password: string): Promise<Session | null> {
  const res = await fetch(`${API_ORIGIN}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include', // รับ Set-Cookie (httpOnly session)
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const body = (await res.json()) as { agent: AuthAgent };
  return { agent: body.agent };
}

/** logout → clear cookie ฝั่ง server (client เคลียร์ session store แยก) */
export async function logout(): Promise<void> {
  await fetch(`${API_ORIGIN}/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function listConversations(): Promise<WireConversation[]> {
  const body = await authedGet<{ conversations: WireConversation[] }>('/inbox/conversations');
  return body.conversations;
}

export async function listMessages(conversationId: string): Promise<WireMessage[]> {
  const body = await authedGet<{ messages: WireMessage[] }>(
    `/inbox/conversations/${conversationId}/messages`,
  );
  return body.messages;
}

export async function reply(conversationId: string, text: string): Promise<WireMessage> {
  const res = await fetch(`${API_ORIGIN}/inbox/conversations/${conversationId}/reply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text }),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`reply failed: ${res.status}`);
  const body = (await res.json()) as { message: WireMessage; delivered: boolean };
  return body.message;
}

/** assign/unassign/close/reopen conversation (Phase 4) → คืน patch (id/status/assignee) */
async function manageAction(
  conversationId: string,
  action: 'assign' | 'unassign' | 'close' | 'reopen',
): Promise<ConversationPatch> {
  const res = await fetch(`${API_ORIGIN}/inbox/conversations/${conversationId}/${action}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
  return ((await res.json()) as { conversation: ConversationPatch }).conversation;
}

export const assignConversation = (id: string) => manageAction(id, 'assign');
export const unassignConversation = (id: string) => manageAction(id, 'unassign');
export const closeConversation = (id: string) => manageAction(id, 'close');
export const reopenConversation = (id: string) => manageAction(id, 'reopen');
