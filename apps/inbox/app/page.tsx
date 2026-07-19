'use client';

import { useSyncExternalStore } from 'react';
import { Inbox } from './components/Inbox';
import { LoginForm } from './components/LoginForm';
import { getServerSnapshot, getSnapshot, setSession, subscribe } from './lib/session-store';

export default function Home() {
  // อ่าน session จาก localStorage แบบ SSR-safe (server = null → hydrate ตรงกัน แล้วค่อยอัปเดตฝั่ง client)
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return session ? (
    <Inbox session={session} onLogout={() => setSession(null)} />
  ) : (
    <LoginForm onLogin={setSession} />
  );
}
