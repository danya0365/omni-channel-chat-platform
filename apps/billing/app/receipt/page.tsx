import { MainLayout } from '@/src/presentation/components/layout/MainLayout';
import { ReceiptView } from '@/src/presentation/components/receipt/ReceiptView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ใบเสร็จรับเงิน | OmniChat',
  description: 'ใบเสร็จรับเงินระบบแชทรวมทุกช่องทาง — หลักฐานการชำระเงิน',
};

export default function ReceiptPage() {
  return (
    <MainLayout showBubbles={false}>
      <ReceiptView />
    </MainLayout>
  );
}
