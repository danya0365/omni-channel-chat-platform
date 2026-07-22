import { MainLayout } from '@/src/presentation/components/layout/MainLayout';
import { PricingView } from '@/src/presentation/components/pricing/PricingView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ราคา — เพิ่มทีมตอบแชทกี่คน ราคาก็เท่าเดิม | OmniChat',
  description:
    'ราคาระบบแชทรวมทุกช่องทาง: ค่าติดตั้งครั้งเดียว + รายเดือนคงที่ ไม่คิดค่าใช้งานรายหัว · ดูแพ็กเกจตามประเภทธุรกิจ',
  openGraph: {
    title: 'ราคา OmniChat — ไม่คิดค่าหัวรายเดือนต่อผู้ใช้',
    description: 'ค่าติดตั้งครั้งเดียว + รายเดือนคงที่ เพิ่มทีมกี่คนราคาก็เท่าเดิม',
    type: 'website',
  },
};

export default function PricingPage() {
  return (
    <MainLayout>
      <PricingView />
    </MainLayout>
  );
}
