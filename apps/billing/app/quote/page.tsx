import { MainLayout } from '@/src/presentation/components/layout/MainLayout';
import { QuoteView } from '@/src/presentation/components/quote/QuoteView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ใบเสนอราคา | OmniChat',
  description: 'ใบเสนอราคาระบบแชทรวมทุกช่องทาง — พิมพ์และส่งให้ลูกค้า',
};

export default function QuotePage() {
  return (
    <MainLayout showBubbles={false}>
      <QuoteView />
    </MainLayout>
  );
}
