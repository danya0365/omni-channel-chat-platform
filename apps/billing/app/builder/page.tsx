import { BuilderView } from '@/src/presentation/components/builder/BuilderView';
import { MainLayout } from '@/src/presentation/components/layout/MainLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'สร้างใบเสนอราคา | OmniChat',
  description: 'เลือกช่องทางแชทและฟีเจอร์ที่ธุรกิจคุณใช้จริง เพื่อกำหนดขอบเขตและงบประมาณ',
  openGraph: {
    title: 'สร้างใบเสนอราคา | OmniChat',
    description: 'เลือกช่องทางแชทและฟีเจอร์ที่ธุรกิจคุณใช้จริง',
  },
};

export default function BuilderPage() {
  return (
    <MainLayout showBubbles={false}>
      <BuilderView />
    </MainLayout>
  );
}
