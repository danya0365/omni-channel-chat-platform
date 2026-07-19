'use client';

import { useEffect, useRef } from 'react';
import type { WireMessage } from '../../../domain/types';
import { MessageBubble } from './message-bubble';

/** พื้นที่ข้อความ + auto-scroll ลงล่างสุดเมื่อมีข้อความใหม่ */
export function MessageThread({ messages }: { messages: WireMessage[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
