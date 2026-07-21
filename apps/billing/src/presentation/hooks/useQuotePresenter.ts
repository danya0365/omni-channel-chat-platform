'use client';

import { DOCUMENT_PREFIXES, DOCUMENT_VALIDITY, VAT_CONFIG } from '@/src/config/quotation.config';
import { formatPrice, getProjectTypeById, tierMonthly, tierSetup } from '@/src/data/mock/mockFeatures';
import { useQuotationStore } from '@/src/presentation/store/quotationStore';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { useCallback, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

/**
 * useQuotePresenter Hook
 * Handles all business logic for QuoteView
 */
export function useQuotePresenter() {
  const {
    deliveryTier, projectType, selectedFeatures, discountPercent, vatOption,
    customerName, customerPhone, customerEmail, notes,
    getSubtotal, getDiscount, getChannelDiscount, getTotal, getMonthlyTotal, getTierData, getSelectedFeaturesData,
    setCustomerInfo, setNotes,
  } = useQuotationStore();

  const tierData = getTierData();
  const tierSetupOf = useCallback(
    (amount: number) => tierSetup(amount, deliveryTier),
    [deliveryTier]
  );
  const tierMonthlyOf = useCallback(
    (amount: number) => tierMonthly(amount, deliveryTier),
    [deliveryTier]
  );

  const printRef = useRef<HTMLDivElement>(null);

  const projectTypeData = useMemo(
    () => (projectType ? getProjectTypeById(projectType) : null),
    [projectType]
  );

  const selectedFeaturesData = useMemo(
    () => getSelectedFeaturesData(),
    [getSelectedFeaturesData]
  );

  const subtotal = getSubtotal();
  const discount = getDiscount();
  const channelDiscount = getChannelDiscount();
  const total = getTotal();
  const vat = vatOption === 'include' ? Math.round(total * VAT_CONFIG.rate) : 0;
  const grandTotal = vatOption === 'include' ? Math.round(total * VAT_CONFIG.multiplier) : total;

  // ค่าบริการรายเดือน — คิดแยกจากค่าติดตั้ง (ไม่มีส่วนลด)
  const monthlyTotal = getMonthlyTotal();
  const monthlyGrandTotal =
    vatOption === 'include' ? Math.round(monthlyTotal * VAT_CONFIG.multiplier) : monthlyTotal;
  const firstYearTotal = grandTotal + monthlyGrandTotal * 12;

  const quoteNumber = useMemo(() => {
    const now = dayjs();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${DOCUMENT_PREFIXES.quote}-${now.format('YYYYMMDD')}-${random}`;
  }, []);

  const quoteDate = useMemo(() => dayjs().locale('th').format('D MMMM YYYY'), []);
  const validUntil = useMemo(
    () => dayjs().add(DOCUMENT_VALIDITY.quoteValidDays, 'day').locale('th').format('D MMMM YYYY'),
    []
  );

  const hasContent = !!(projectType || selectedFeatures.length > 0);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบเสนอราคา-${quoteNumber}`,
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
    quoteNumber, quoteDate, validUntil,
    projectType, projectTypeData,
    selectedFeatures, selectedFeaturesData,
    subtotal, discount, channelDiscount, discountPercent, total, vat, grandTotal, vatOption,
    monthlyTotal, monthlyGrandTotal, firstYearTotal,
    tierData, tierSetupOf, tierMonthlyOf,
    customerName, customerPhone, customerEmail, notes,
    handlePrint, updateCustomerName, updateCustomerPhone, updateCustomerEmail, updateNotes,
    formatPrice,
  };
}
