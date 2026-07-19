import { SessionGate } from '@/presentation/components/auth/session-gate';

// Server Component — routing เท่านั้น · client logic (session gate) อยู่ใน SessionGate ('use client')
export default function Home() {
  return <SessionGate />;
}
