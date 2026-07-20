'use client';

import { useEffect, useState } from 'react';
import { inboxWsUrl } from '../../data/inbox-api';
import type { AgentEvent } from '../../domain/types';
import { useLatestRef } from './use-latest-ref';

export type WsStatus = 'connecting' | 'online' | 'offline';

interface Handlers {
  /** เรียกทุกครั้งที่ (re)connect สำเร็จ — ใช้ refetch สายที่อาจพลาดตอนหลุด */
  onOpen?: () => void;
  onEvent: (event: AgentEvent) => void;
}

/**
 * เชื่อม agent WS ไป apps/api (reconnect อัตโนมัติทุก 1.5s) — auth ผ่าน cookie (แนบกับ handshake)
 * handler เก็บใน latest-ref → เปลี่ยน handler ไม่ทำให้ reconnect (subscribe แค่ [handlersRef])
 */
export function useInboxSocket(handlers: Handlers): WsStatus {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const handlersRef = useLatestRef(handlers);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      setStatus('connecting');
      const ws = new WebSocket(inboxWsUrl());
      socket = ws;
      ws.onopen = () => {
        setStatus('online');
        handlersRef.current.onOpen?.();
      };
      ws.onmessage = (ev) => {
        let event: AgentEvent;
        try {
          event = JSON.parse(String(ev.data)) as AgentEvent;
        } catch {
          return; // ข้อความที่ไม่ใช่ JSON → ข้าม
        }
        handlersRef.current.onEvent(event);
      };
      ws.onclose = () => {
        setStatus('offline');
        if (!stopped) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [handlersRef]);

  return status;
}
