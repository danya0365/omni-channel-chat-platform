'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  assignConversation,
  closeConversation,
  listConversations,
  reopenConversation,
  unassignConversation,
  UnauthorizedError,
} from '../../data/inbox-api';
import { bumpWithMessage, patchConversation, upsertConversation } from '../lib/conversation-view';
import type { ConversationPatch, WireConversation, WireMessage } from '../../domain/types';
import { useLatestRef } from './use-latest-ref';

export interface UseConversations {
  conversations: WireConversation[];
  /** ดึงลิสต์ใหม่ทั้งหมด (เรียกตอน (re)connect เพื่อ sync สายที่พลาด) */
  refresh: () => Promise<void>;
  /** message realtime → ดันสายขึ้นบน · สายที่ยังไม่มีในลิสต์ → refresh */
  applyMessage: (conversationId: string, message: WireMessage) => void;
  /** conversation event → upsert */
  applyConversation: (conversation: WireConversation) => void;
  /** มี manage action กำลังทำงานอยู่ (ใช้ disable ปุ่ม) */
  acting: boolean;
  assign: (conversationId: string) => Promise<void>;
  unassign: (conversationId: string) => Promise<void>;
  close: (conversationId: string) => Promise<void>;
  reopen: (conversationId: string) => Promise<void>;
}

/**
 * state ของ conversation list + reducer (bump/upsert/patch) + refresh + manage actions
 * component เรียก assign/close ผ่าน hook นี้ (ไม่ import data เอง) · setState เกิดจาก event/callback เท่านั้น
 */
export function useConversations(token: string, onAuthError: () => void): UseConversations {
  const [conversations, setConversations] = useState<WireConversation[]>([]);
  const [acting, setActing] = useState(false);
  const listRef = useLatestRef(conversations);

  const refresh = useCallback(async () => {
    try {
      setConversations(await listConversations(token));
    } catch (e) {
      if (e instanceof UnauthorizedError) onAuthError();
    }
  }, [token, onAuthError]);

  const applyMessage = useCallback(
    (conversationId: string, message: WireMessage) => {
      if (!listRef.current.some((c) => c.id === conversationId)) {
        void refresh(); // สายใหม่ที่ยังไม่รู้จัก → ดึงมาทั้งลิสต์
        return;
      }
      setConversations((prev) => bumpWithMessage(prev, conversationId, message).next);
    },
    [listRef, refresh],
  );

  const applyConversation = useCallback((conversation: WireConversation) => {
    setConversations((prev) => upsertConversation(prev, conversation));
  }, []);

  // manage action → เรียก api + merge patch · WS จะ sync ซ้ำ (idempotent) · error/token หมดอายุ → refresh/logout
  const runManage = useCallback(
    async (id: string, action: (t: string, id: string) => Promise<ConversationPatch>) => {
      setActing(true);
      try {
        const patch = await action(token, id);
        setConversations((prev) => patchConversation(prev, patch));
      } catch (e) {
        if (e instanceof UnauthorizedError) onAuthError();
        else void refresh();
      } finally {
        setActing(false);
      }
    },
    [token, onAuthError, refresh],
  );

  const assign = useCallback((id: string) => runManage(id, assignConversation), [runManage]);
  const unassign = useCallback((id: string) => runManage(id, unassignConversation), [runManage]);
  const close = useCallback((id: string) => runManage(id, closeConversation), [runManage]);
  const reopen = useCallback((id: string) => runManage(id, reopenConversation), [runManage]);

  return useMemo(
    () => ({
      conversations,
      refresh,
      applyMessage,
      applyConversation,
      acting,
      assign,
      unassign,
      close,
      reopen,
    }),
    [
      conversations,
      refresh,
      applyMessage,
      applyConversation,
      acting,
      assign,
      unassign,
      close,
      reopen,
    ],
  );
}
