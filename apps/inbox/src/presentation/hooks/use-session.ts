'use client';

import { useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  setSession as writeSession,
  subscribe,
} from '../../data/session-store';
import type { Session } from '../../domain/types';

/** session ปัจจุบันจาก localStorage store (SSR-safe) + setter — ห่อ data/session-store */
export function useSession(): {
  session: Session | null;
  setSession: (session: Session | null) => void;
} {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { session, setSession: writeSession };
}
