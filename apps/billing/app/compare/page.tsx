import { CompareView } from '@/src/presentation/components/compare/CompareView';
import { MainLayout } from '@/src/presentation/components/layout/MainLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ใบเสนอราคา — เทียบแพ็กเกจ | OmniChat',
  description: 'ใบเสนอราคาแบบเทียบ 3 แพ็กเกจในใบเดียว — พิมพ์ส่งให้ลูกค้าเลือก',
};

export default function ComparePage() {
  return (
    <MainLayout showBubbles={false}>
      <CompareView />
    </MainLayout>
  );
}
