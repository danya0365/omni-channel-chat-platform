import { MainLayout } from '@/src/presentation/components/layout/MainLayout';
import { PrivacyView } from '@/src/presentation/components/privacy/PrivacyView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'นโยบายความเป็นส่วนตัว | OmniChat',
  description: 'นโยบายความเป็นส่วนตัวของ OmniChat — การเก็บข้อมูล การปกป้องข้อความและ PII ของลูกค้า',
};

export default function PrivacyPage() {
  return (
    <MainLayout>
      <PrivacyView />
    </MainLayout>
  );
}
