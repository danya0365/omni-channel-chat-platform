// Session store สำหรับ useSyncExternalStore — อ่าน/เขียน localStorage แบบ SSR-safe
// (getServerSnapshot คืน null → ไม่ hydration mismatch · setSession แจ้ง subscriber ให้ re-render)

import type { Session } from './types';

const KEY = 'omni_inbox_session';

let cached: Session | null | undefined; // undefined = ยังไม่อ่านจาก storage
const listeners = new Set<() => void>();

function read(): Session | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** snapshot ฝั่ง client — reference คงที่จนกว่า setSession (ต้อง stable สำหรับ useSyncExternalStore) */
export function getSnapshot(): Session | null {
  if (cached === undefined) cached = read();
  return cached;
}

/** snapshot ฝั่ง server / ตอน hydrate — null เสมอ (localStorage ไม่มีบน server) */
export function getServerSnapshot(): Session | null {
  return null;
}

export function setSession(session: Session | null): void {
  cached = session;
  if (typeof localStorage !== 'undefined') {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  }
  listeners.forEach((l) => l());
}
