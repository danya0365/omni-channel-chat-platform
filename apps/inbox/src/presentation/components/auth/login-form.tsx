'use client';

import { useState } from 'react';
import type { Session } from '../../../domain/types';
import { useAuth } from '../../hooks/use-auth';
import { Button } from '../ui/button';
import { TextInput } from '../ui/text-input';

const LABEL = 'mb-1 block text-sm font-medium text-card-foreground';

export function LoginForm({ onLogin }: { onLogin: (session: Session) => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await signIn(email, password);
      if (!session) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        return;
      }
      onLogin(session);
    } catch {
      setError('เชื่อมต่อ server ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-card-foreground">Omni Inbox</h1>
        <p className="mt-1 mb-6 text-sm text-muted">เข้าสู่ระบบทีมงาน</p>

        <label className={LABEL} htmlFor="login-email">
          อีเมล
        </label>
        <TextInput
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          className="mb-4 w-full"
          placeholder="agent@demo.local"
        />

        <label className={LABEL} htmlFor="login-password">
          รหัสผ่าน
        </label>
        <TextInput
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mb-4 w-full"
          placeholder="••••••••"
        />

        {error && <p className="mb-4 text-sm text-error">{error}</p>}

        <Button type="submit" size="block" disabled={busy}>
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
    </div>
  );
}
