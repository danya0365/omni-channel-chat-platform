'use client';

import {
    FEATURE_CATEGORIES,
    PROJECT_TYPES,
    calculatePackageMonthlyPrice,
    calculatePackagePrice,
    formatPrice,
    getFeaturesByCategory,
    getPackagesForProjectType,
    getProjectTypeById,
    type FeaturePackage,
} from '@/src/data/mock/mockFeatures';
import { useCallback, useMemo, useState } from 'react';

/** ราคาเริ่มต้นอิงรูปแบบการจ้างที่ถูกที่สุด (ตัวคูณ ×1.0) — หน้า public โชว์ "เริ่มต้นที่" */
const BASE_TIER_ID = 'solo-ai';

/** ค่าเริ่มต้น = ICP หัวหอกตาม ADR-0008 (เอเจนซี่/หลายแบรนด์) */
const DEFAULT_PROJECT_TYPE = 'agency';

/**
 * ปัดขึ้นให้เป็นเลขกลม — ราคาดิบจาก catalog เป็นผลคูณ tier + ส่วนลด จึงออกมาเป็นเศษ
 * (เช่น 47,027) ซึ่งบนหน้าเว็บอ่านแล้วเหมือนเครื่องคิดเลขพ่น ไม่ใช่ราคาที่ตั้งใจตั้ง
 * ปัด "ขึ้น" เสมอ เพื่อไม่ให้โฆษณาถูกกว่าราคาจริงที่จะเสนอ
 */
function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export interface PricingPackageCard {
  pkg: FeaturePackage;
  /** ค่าติดตั้งครั้งเดียว (ยังไม่รวม VAT) */
  setup: number;
  /** ค่าบริการรายเดือน (ยังไม่รวม VAT) */
  monthly: number;
  /** หมวดที่แพ็กเกจนี้ครอบคลุม — ใช้เป็น bullet บนการ์ด */
  highlights: string[];
  isRecommended: boolean;
}

/**
 * usePricingPresenter Hook
 * หน้าราคาสาธารณะ — "อ่านอย่างเดียว" ให้ลูกค้าเห็นว่าราคาประมาณเท่าไหร่ก่อนติดต่อ
 *
 * ตั้งใจ **ไม่แตะ quotationStore** เพราะนั่นเป็น state ของใบเสนอราคาที่เรากำลังทำอยู่ —
 * คนเข้าเว็บมาดูราคาไม่ควรไปทับใบที่เราค้างไว้
 */
export function usePricingPresenter() {
  const [projectType, setProjectType] = useState<string>(DEFAULT_PROJECT_TYPE);

  const projectTypeData = useMemo(
    () => getProjectTypeById(projectType) ?? null,
    [projectType]
  );

  const packages = useMemo(() => getPackagesForProjectType(projectType), [projectType]);

  const cards = useMemo<PricingPackageCard[]>(
    () =>
      packages.map((pkg, index) => {
        // หมวดที่แพ็กเกจนี้แตะถึง — บอกภาพรวมโดยไม่ต้องลิสต์ 60 ฟีเจอร์
        const highlights = FEATURE_CATEGORIES.filter((category) =>
          getFeaturesByCategory(category.id).some((f) => pkg.features.includes(f.id))
        ).map((category) => category.name);

        return {
          pkg,
          // BASE_TIER_ID เป็นตัวคูณ ×1.0 — ราคาที่ได้จึงเป็นเรตเริ่มต้นตรงๆ
          setup: roundUpTo(calculatePackagePrice(pkg, projectType), 1000),
          monthly: roundUpTo(calculatePackageMonthlyPrice(pkg, projectType), 100),
          highlights,
          isRecommended: packages.length === 3 ? index === 1 : false,
        };
      }),
    [packages, projectType]
  );

  const changeProjectType = useCallback((id: string) => setProjectType(id), []);

  return {
    projectTypes: PROJECT_TYPES,
    projectType,
    projectTypeData,
    changeProjectType,
    cards,
    baseTierId: BASE_TIER_ID,
    formatPrice,
  };
}
