'use client';

import { useCallback, useMemo, useState } from 'react';
import { listMessages, reply, UnauthorizedError } from '../../data/inbox-api';
import type { WireMessage } from '../../domain/types';

export interface UseMessages {
  messages: WireMessage[];
  /** โหลดประวัติของสายที่เลือก (ล้างของเดิมก่อน) */
  loadFor: (conversationId: string) => Promise<void>;
  /** append ข้อความ realtime (กัน duplicate ด้วย id) */
  append: (message: WireMessage) => void;
  /** ส่งข้อความตอบ · คืน true ถ้าสำเร็จ (ReplyForm จะเคลียร์ช่อง) */
  send: (conversationId: string, text: string) => Promise<boolean>;
}

/**
 * ข้อความของสายที่เลือก — โหลด/append(realtime)/ส่งตอบ
 * โหลดผ่าน loadFor (event handler ตอนคลิกสาย) ไม่ใช่ effect → ไม่ผิด set-state-in-effect
 */
export function useMessages(token: string, onAuthError: () => void): UseMessages {
  const [messages, setMessages] = useState<WireMessage[]>([]);

  const append = useCallback((message: WireMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }, []);

  const loadFor = useCallback(
    async (conversationId: string) => {
      setMessages([]);
      try {
        const history = await listMessages(token, conversationId);
        setMessages(history.slice().reverse()); // api ใหม่→เก่า · แสดงเก่า→ใหม่
      } catch (e) {
        if (e instanceof UnauthorizedError) onAuthError();
      }
    },
    [token, onAuthError],
  );

  const send = useCallback(
    async (conversationId: string, text: string): Promise<boolean> => {
      try {
        append(await reply(token, conversationId, text));
        return true;
      } catch (e) {
        if (e instanceof UnauthorizedError) onAuthError();
        return false;
      }
    },
    [token, onAuthError, append],
  );

  return useMemo(() => ({ messages, loadFor, append, send }), [messages, loadFor, append, send]);
}
