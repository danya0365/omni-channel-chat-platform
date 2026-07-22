'use client';

import type { DeliveryTier, ProjectType } from '@/src/data/mock/mockFeatures';

interface CompareControlsProps {
  projectTypes: ProjectType[];
  projectType: string | null;
  onProjectTypeChange: (id: string) => void;
  deliveryTiers: DeliveryTier[];
  deliveryTier: string;
  onDeliveryTierChange: (id: string) => void;
  vatOption: 'include' | 'exclude' | 'exempt';
  onVatOptionChange: (option: 'include' | 'exclude' | 'exempt') => void;
}

/**
 * แถบตั้งค่าใบเทียบแพ็กเกจ — เครื่องมือฝั่งเราเท่านั้น ไม่ติดไปกับเอกสารที่พิมพ์ (print-hidden)
 */
export function CompareControls({
  projectTypes,
  projectType,
  onProjectTypeChange,
  deliveryTiers,
  deliveryTier,
  onDeliveryTierChange,
  vatOption,
  onVatOptionChange,
}: CompareControlsProps) {
  return (
    <div className="cmp-controls print-hidden">
      <label className="cmp-control">
        <span className="cmp-control-label">ประเภทธุรกิจของลูกค้า</span>
        <select
          className="doc-input"
          value={projectType ?? ''}
          onChange={(e) => onProjectTypeChange(e.target.value)}
        >
          <option value="" disabled>
            เลือกประเภทธุรกิจ
          </option>
          {projectTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.icon} {type.name}
            </option>
          ))}
        </select>
      </label>

      <label className="cmp-control">
        <span className="cmp-control-label">รูปแบบการจ้าง</span>
        <select
          className="doc-input"
          value={deliveryTier}
          onChange={(e) => onDeliveryTierChange(e.target.value)}
        >
          {deliveryTiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.icon} {tier.name}
            </option>
          ))}
        </select>
      </label>

      <label className="cmp-control">
        <span className="cmp-control-label">VAT</span>
        <select
          className="doc-input"
          value={vatOption}
          onChange={(e) => onVatOptionChange(e.target.value as 'include' | 'exclude' | 'exempt')}
        >
          <option value="include">รวม VAT 7%</option>
          <option value="exclude">ยังไม่รวม VAT</option>
          <option value="exempt">ยกเว้น VAT</option>
        </select>
      </label>
    </div>
  );
}
