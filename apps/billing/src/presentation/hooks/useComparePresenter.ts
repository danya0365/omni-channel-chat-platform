'use client';

import { DOCUMENT_VALIDITY, VAT_CONFIG } from '@/src/config/quotation.config';
import {
    DELIVERY_TIERS,
    FEATURE_CATEGORIES,
    PROJECT_TYPES,
    calculatePackageMonthlyPrice,
    calculatePackagePrice,
    formatPrice,
    getDeliveryTierById,
    getFeaturesByCategory,
    getPackagesForProjectType,
    getProjectTypeById,
    tierMonthly,
    tierSetup,
    type FeaturePackage,
} from '@/src/data/mock/mockFeatures';
import { useIssuedDocument } from '@/src/presentation/hooks/useIssuedDocument';
import { useQuotationStore } from '@/src/presentation/store/quotationStore';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { useCallback, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

/** ราคาของ 1 แพ็กเกจ หลังคูณรูปแบบการจ้างและคิด VAT แล้ว */
export interface PackageColumn {
  pkg: FeaturePackage;
  /** ค่าติดตั้งครั้งเดียว (ยังไม่รวม VAT) */
  setup: number;
  /** ค่าติดตั้งที่ลูกค้าจ่ายจริง */
  setupTotal: number;
  /** ค่าบริการรายเดือน (ยังไม่รวม VAT) */
  monthly: number;
  /** ค่าบริการรายเดือนที่ลูกค้าจ่ายจริง */
  monthlyTotal: number;
  /** ค่าใช้จ่ายรวมปีแรก = ค่าติดตั้ง + รายเดือน × 12 */
  firstYearTotal: number;
  /** แพ็กเกจที่เราแนะนำ (ตัวกลาง) — ใช้ highlight ในเอกสาร */
  isRecommended: boolean;
}

/** 1 แถวของตารางเทียบ = 1 หมวดฟีเจอร์ */
export interface ComparisonRow {
  categoryId: string;
  categoryName: string;
  icon: string;
  /** จำนวนฟีเจอร์ทั้งหมดในหมวดนี้ที่มีขาย */
  totalInCategory: number;
  /** ผลของแต่ละแพ็กเกจ เรียงตรงกับ packageColumns */
  cells: { count: number; featureNames: string[] }[];
}

/**
 * useComparePresenter Hook
 * ใบเสนอราคาแบบ "เทียบ 3 แพ็กเกจในใบเดียว"
 *
 * ทำไมไม่ใช้ selectedFeatures ใน store เหมือนใบปกติ:
 * ใบนี้ต้องคิดราคา 3 ชุดพร้อมกัน — ใช้ `calculatePackagePrice` ที่เป็น pure function
 * คำนวณตรงจาก catalog แทน จึงไม่แตะ/ไม่ทับ state ของใบเสนอราคาปกติ
 *
 * ตารางเทียบสรุปที่ระดับ "หมวด" ไม่ใช่รายฟีเจอร์ เพราะแพ็กเกจใหญ่มีถึง 63 ฟีเจอร์
 * ลิสต์รายชิ้น × 3 คอลัมน์ = เอกสารยาวหลายหน้าจนลูกค้าไม่อ่าน
 */
export function useComparePresenter() {
  const {
    deliveryTier, projectType, vatOption,
    customerName, customerPhone, customerEmail, notes,
    setDeliveryTier, setProjectType, setVatOption, setCustomerInfo, setNotes,
  } = useQuotationStore();

  const printRef = useRef<HTMLDivElement>(null);

  // ใช้ชุดเลขเดียวกับใบเสนอราคาปกติ — ใบเทียบก็คือใบเสนอราคาใบหนึ่ง
  const {
    documentNumber: quoteNumber,
    documentDate: quoteDate,
    issuedAt,
    isReady: isDocumentReady,
    reissueNumber,
  } = useIssuedDocument('quote');

  const validUntil = useMemo(
    () =>
      issuedAt
        ? dayjs(issuedAt)
            .add(DOCUMENT_VALIDITY.quoteValidDays, 'day')
            .locale('th')
            .format('D MMMM YYYY')
        : '',
    [issuedAt]
  );

  const projectTypeData = useMemo(
    () => (projectType ? getProjectTypeById(projectType) ?? null : null),
    [projectType]
  );
  const tierData = useMemo(() => getDeliveryTierById(deliveryTier) ?? null, [deliveryTier]);

  const packages = useMemo(
    () => (projectType ? getPackagesForProjectType(projectType) : []),
    [projectType]
  );

  const withVat = useCallback(
    (amount: number) =>
      vatOption === 'include' ? Math.round(amount * VAT_CONFIG.multiplier) : amount,
    [vatOption]
  );

  const packageColumns = useMemo<PackageColumn[]>(() => {
    if (!projectType) return [];

    return packages.map((pkg, index) => {
      const setup = tierSetup(calculatePackagePrice(pkg, projectType), deliveryTier);
      const monthly = tierMonthly(calculatePackageMonthlyPrice(pkg, projectType), deliveryTier);
      const setupTotal = withVat(setup);
      const monthlyTotal = withVat(monthly);

      return {
        pkg,
        setup,
        setupTotal,
        monthly,
        monthlyTotal,
        firstYearTotal: setupTotal + monthlyTotal * 12,
        // ตัวกลาง = ตัวที่เราแนะนำ (แพ็กเกจมาตรฐาน)
        isRecommended: packages.length === 3 ? index === 1 : false,
      };
    });
  }, [packages, projectType, deliveryTier, withVat]);

  const comparisonRows = useMemo<ComparisonRow[]>(() => {
    if (packages.length === 0) return [];

    return FEATURE_CATEGORIES.map((category) => {
      const featuresInCategory = getFeaturesByCategory(category.id);

      return {
        categoryId: category.id,
        categoryName: category.name,
        icon: category.icon,
        totalInCategory: featuresInCategory.length,
        cells: packages.map((pkg) => {
          const included = featuresInCategory.filter((f) => pkg.features.includes(f.id));
          return { count: included.length, featureNames: included.map((f) => f.name) };
        }),
      };
      // หมวดที่ไม่มีแพ็กเกจไหนได้เลย = ไม่ได้ขายในชุดนี้ ตัดออกให้เอกสารสั้นลง
    }).filter((row) => row.cells.some((cell) => cell.count > 0));
  }, [packages]);

  const hasContent = packageColumns.length > 0;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบเสนอราคา-เทียบแพ็กเกจ-${quoteNumber}`,
    pageStyle: `
      @page { size: A4; margin: 8mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11px; }
        .print-hidden { display: none !important; }
        .print-show { display: block !important; }
      }
    `,
  });

  const updateCustomerName = useCallback((name: string) => setCustomerInfo({ name }), [setCustomerInfo]);
  const updateCustomerPhone = useCallback((phone: string) => setCustomerInfo({ phone }), [setCustomerInfo]);
  const updateCustomerEmail = useCallback((email: string) => setCustomerInfo({ email }), [setCustomerInfo]);
  const updateNotes = useCallback((newNotes: string) => setNotes(newNotes), [setNotes]);

  return {
    printRef, hasContent,
    quoteNumber, quoteDate, validUntil, isDocumentReady, reissueNumber,
    projectType, projectTypeData, projectTypes: PROJECT_TYPES,
    deliveryTier, tierData, deliveryTiers: DELIVERY_TIERS,
    vatOption,
    packageColumns, comparisonRows,
    customerName, customerPhone, customerEmail, notes,
    setProjectType, setDeliveryTier, setVatOption,
    updateCustomerName, updateCustomerPhone, updateCustomerEmail, updateNotes,
    handlePrint,
    formatPrice,
  };
}
