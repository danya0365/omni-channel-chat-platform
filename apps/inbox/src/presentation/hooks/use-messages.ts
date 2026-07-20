'use client';

import { useCallback, useMemo, useState } from 'react';
import { listMessages, reply, UnauthorizedError } from '../../data/inbox-api';
import type { WireMessage } from '../../domain/types';

export interface UseMessages {
  messages: WireMessage[];
  /** โหลดประวัติของสายที่เลือก (ล้างของเดิมก่อน) */
  loadFor: (conversationId: string) => Promise<void>;
  /** upsert ข้อความ realtime — id ใหม่ = append · id เดิม = replace (อัปสถานะ เช่น sent→failed) */
  append: (message: WireMessage) => void;
  /** ส่งข้อความตอบ · คืน true ถ้าสำเร็จ (ReplyForm จะเคลียร์ช่อง) */
  send: (conversationId: string, text: string) => Promise<boolean>;
}

/**
 * ข้อความของสายที่เลือก — โหลด/append(realtime)/ส่งตอบ
 * โหลดผ่าน loadFor (event handler ตอนคลิกสาย) ไม่ใช่ effect → ไม่ผิด set-state-in-effect
 */
export function useMessages(onAuthError: () => void): UseMessages {
  const [messages, setMessages] = useState<WireMessage[]>([]);

  const append = useCallback((message: WireMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === message.id);
      if (idx === -1) return [...prev, message]; // ใหม่ → ต่อท้าย
      const existing = prev[idx];
      if (existing && existing.status === message.status) return prev; // ไม่มีอะไรเปลี่ยน
      const next = prev.slice(); // id เดิม + status เปลี่ยน (sent→failed) → replace คงตำแหน่ง
      next[idx] = message;
      return next;
    });
  }, []);

  const loadFor = useCallback(
    async (conversationId: string) => {
      setMessages([]);
      try {
        const history = await listMessages(conversationId);
        setMessages(history.slice().reverse()); // api ใหม่→เก่า · แสดงเก่า→ใหม่
      } catch (e) {
        if (e instanceof UnauthorizedError) onAuthError();
      }
    },
    [onAuthError],
  );

  const send = useCallback(
    async (conversationId: string, text: string): Promise<boolean> => {
      try {
        append(await reply(conversationId, text));
        return true;
      } catch (e) {
        if (e instanceof UnauthorizedError) onAuthError();
        return false;
      }
    },
    [onAuthError, append],
  );

  return useMemo(() => ({ messages, loadFor, append, send }), [messages, loadFor, append, send]);
}
