'use client';

import { useState } from 'react';
import { login } from '../lib/api';
import type { Session } from '../lib/types';

export function LoginForm({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await login(email.trim(), password);
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
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Omni Inbox</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-500">เข้าสู่ระบบทีมงาน</p>

        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          อีเมล
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="agent@demo.local"
        />

        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          รหัสผ่าน
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="••••••••"
        />

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
