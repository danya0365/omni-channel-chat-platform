'use client';

import { useSession } from '../../hooks/use-session';
import { useAuth } from '../../hooks/use-auth';
import { Inbox } from '../inbox/inbox';
import { LoginForm } from './login-form';

/** client gate — มี session → Inbox · ไม่มี → LoginForm (อ่าน session จาก store ผ่าน useSession) */
export function SessionGate() {
  const { session, setSession } = useSession();
  const { signOut } = useAuth();
  // logout: clear cookie ฝั่ง server + เคลียร์ session store ฝั่ง client
  const handleLogout = () => {
    void signOut();
    setSession(null);
  };
  return session ? (
    <Inbox session={session} onLogout={handleLogout} />
  ) : (
    <LoginForm onLogin={setSession} />
  );
}
