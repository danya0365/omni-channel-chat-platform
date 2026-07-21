import { AboutView } from '@/src/presentation/components/about/AboutView';
import { MainLayout } from '@/src/presentation/components/layout/MainLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'เกี่ยวกับเรา | OmniChat',
  description: 'รู้จัก OmniChat — แพลตฟอร์มรวมแชททุกช่องทาง พร้อมใบเสนอราคา ใบแจ้งหนี้ และใบเสร็จ',
};

export default function AboutPage() {
  return (
    <MainLayout>
      <AboutView />
    </MainLayout>
  );
}
