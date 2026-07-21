import { InvoiceView } from '@/src/presentation/components/invoice/InvoiceView';
import { MainLayout } from '@/src/presentation/components/layout/MainLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ใบแจ้งหนี้ | OmniChat',
  description: 'ใบแจ้งหนี้ระบบแชทรวมทุกช่องทาง — ช่องทางชำระเงินพร้อม',
};

export default function InvoicePage() {
  return (
    <MainLayout showBubbles={false}>
      <InvoiceView />
    </MainLayout>
  );
}
