'use client';

import { useCallback, useMemo, useState } from 'react';
import { getEntitlements, UnauthorizedError } from '../../data/inbox-api';
import type { UiEntitlementModule } from '../../domain/types';

export interface UseEntitlements {
  modules: UiEntitlementModule[];
  /** โหลดสิทธิ์ใหม่ — เรียกตอน (re)connect คู่กับ refresh ลิสต์สนทนา */
  refresh: () => Promise<void>;
  /** workspace นี้ซื้อโมดูลนี้ไหม — ใช้ซ่อนเมนู (UX เท่านั้น) */
  has: (module: UiEntitlementModule) => boolean;
}

/**
 * สิทธิ์ของ workspace (Phase 6) — **ไว้ซ่อนเมนูเท่านั้น ไม่ใช่ security**
 * server บังคับสิทธิ์เองทุก route (ADR-0007) → แก้ state ฝั่ง client ก็ยิง API ไม่ผ่านอยู่ดี
 * default = ว่าง (ยังไม่โหลด) → ซ่อนไว้ก่อน แล้วค่อยโผล่เมื่อรู้ว่าซื้อจริง (fail-closed ฝั่ง UX ด้วย)
 */
export function useEntitlements(onAuthError: () => void): UseEntitlements {
  const [modules, setModules] = useState<UiEntitlementModule[]>([]);

  // client-fetch: โหลดตอน WS (re)connect — inbox เป็น client SPA (ดู rule frontend-next §4)
  const refresh = useCallback(async () => {
    try {
      setModules(await getEntitlements());
    } catch (e) {
      if (e instanceof UnauthorizedError) onAuthError();
    }
  }, [onAuthError]);

  const has = useCallback((module: UiEntitlementModule) => modules.includes(module), [modules]);

  return useMemo(() => ({ modules, refresh, has }), [modules, refresh, has]);
}
