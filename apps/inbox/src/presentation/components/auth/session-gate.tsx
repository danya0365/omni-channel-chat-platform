'use client';

import { useSession } from '../../hooks/use-session';
import { Inbox } from '../inbox/inbox';
import { LoginForm } from './login-form';

/** client gate — มี session → Inbox · ไม่มี → LoginForm (อ่าน session จาก store ผ่าน useSession) */
export function SessionGate() {
  const { session, setSession } = useSession();
  return session ? (
    <Inbox session={session} onLogout={() => setSession(null)} />
  ) : (
    <LoginForm onLogin={setSession} />
  );
}
