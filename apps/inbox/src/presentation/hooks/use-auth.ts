'use client';

import { useCallback } from 'react';
import { login as loginApi, logout as logoutApi } from '../../data/inbox-api';
import type { Session } from '../../domain/types';

/** auth ฝั่ง client — ห่อ data/inbox-api ให้ component เรียกผ่าน hook (component ไม่ import data ตรง) */
export function useAuth() {
  /** คืน Session ถ้าสำเร็จ · null ถ้า credential ผิด (throw ถ้าเชื่อม server ไม่ได้) */
  const signIn = useCallback(
    (email: string, password: string): Promise<Session | null> => loginApi(email.trim(), password),
    [],
  );
  /** clear session cookie ฝั่ง server (best-effort — ไม่ throw ต่อ) */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await logoutApi();
    } catch {
      /* offline ก็ยัง logout ฝั่ง client ได้ */
    }
  }, []);
  return { signIn, signOut };
}
