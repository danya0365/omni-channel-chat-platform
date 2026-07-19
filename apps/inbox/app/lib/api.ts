// API client ของ inbox — คุย apps/api ผ่าน HTTP + WS เท่านั้น (ไม่แตะ DB ตรง)
// token เก็บใน localStorage (public identifier ฝั่ง client — ไม่มี secret ในบันเดิล)

import type { AuthAgent, ConversationPatch, Session, WireConversation, WireMessage } from './types';

export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:3001';

/** ws:// หรือ wss:// ตาม origin ของ api */
export function inboxWsUrl(token: string): string {
  const wsBase = API_ORIGIN.replace(/^http/, 'ws');
  return `${wsBase}/inbox/ws?token=${encodeURIComponent(token)}`;
}

/** error ที่รู้ว่า token หมดอายุ/ไม่ผ่าน (caller → logout) */
export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

async function authedGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function login(email: string, password: string): Promise<Session | null> {
  const res = await fetch(`${API_ORIGIN}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const body = (await res.json()) as { token: string; agent: AuthAgent };
  return { token: body.token, agent: body.agent };
}

export async function listConversations(token: string): Promise<WireConversation[]> {
  const body = await authedGet<{ conversations: WireConversation[] }>(
    token,
    '/inbox/conversations',
  );
  return body.conversations;
}

export async function listMessages(token: string, conversationId: string): Promise<WireMessage[]> {
  const body = await authedGet<{ messages: WireMessage[] }>(
    token,
    `/inbox/conversations/${conversationId}/messages`,
  );
  return body.messages;
}

export async function reply(
  token: string,
  conversationId: string,
  text: string,
): Promise<WireMessage> {
  const res = await fetch(`${API_ORIGIN}/inbox/conversations/${conversationId}/reply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`reply failed: ${res.status}`);
  const body = (await res.json()) as { message: WireMessage; delivered: boolean };
  return body.message;
}

/** assign/unassign/close/reopen conversation (Phase 4) → คืน patch (id/status/assignee) */
async function manageAction(
  token: string,
  conversationId: string,
  action: 'assign' | 'unassign' | 'close' | 'reopen',
): Promise<ConversationPatch> {
  const res = await fetch(`${API_ORIGIN}/inbox/conversations/${conversationId}/${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
  return ((await res.json()) as { conversation: ConversationPatch }).conversation;
}

export const assignConversation = (token: string, id: string) => manageAction(token, id, 'assign');
export const unassignConversation = (token: string, id: string) =>
  manageAction(token, id, 'unassign');
export const closeConversation = (token: string, id: string) => manageAction(token, id, 'close');
export const reopenConversation = (token: string, id: string) => manageAction(token, id, 'reopen');
