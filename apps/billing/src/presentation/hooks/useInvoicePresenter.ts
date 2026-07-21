'use client';

import { DOCUMENT_PREFIXES, DOCUMENT_VALIDITY, VAT_CONFIG } from '@/src/config/quotation.config';
import { formatPrice, getProjectTypeById, tierMonthly, tierSetup } from '@/src/data/mock/mockFeatures';
import { useQuotationStore } from '@/src/presentation/store/quotationStore';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';

/**
 * useInvoicePresenter Hook
 * Handles all business logic for InvoiceView
 */
export function useInvoicePresenter() {
  const {
    deliveryTier, projectType, selectedFeatures, discountPercent, vatOption,
    customerName, customerPhone, customerEmail, notes,
    getSubtotal, getDiscount, getChannelDiscount, getTotal, getMonthlyTotal, getTierData, getSelectedFeaturesData,
    setCustomerInfo, setNotes,
  } = useQuotationStore();

  const tierData = getTierData();
  const tierSetupOf = useCallback((amount: number) => tierSetup(amount, deliveryTier), [deliveryTier]);
  const tierMonthlyOf = useCallback((amount: number) => tierMonthly(amount, deliveryTier), [deliveryTier]);

  const printRef = useRef<HTMLDivElement>(null);
  const [dueDate, setDueDate] = useState(
    dayjs().add(DOCUMENT_VALIDITY.invoiceDueDays, 'day').format('YYYY-MM-DD')
  );

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

  const invoiceNumber = useMemo(() => {
    const now = dayjs();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${DOCUMENT_PREFIXES.invoice}-${now.format('YYYYMMDD')}-${random}`;
  }, []);

  const invoiceDate = useMemo(() => dayjs().locale('th').format('D MMMM YYYY'), []);
  const formattedDueDate = useMemo(
    () => dayjs(dueDate).locale('th').format('D MMMM YYYY'),
    [dueDate]
  );

  const hasContent = !!(projectType || selectedFeatures.length > 0);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบแจ้งหนี้-${invoiceNumber}`,
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
  const updateDueDate = useCallback((date: string) => setDueDate(date), []);

  return {
    printRef, hasContent,
    invoiceNumber, invoiceDate, dueDate, formattedDueDate,
    projectType, projectTypeData,
    selectedFeatures, selectedFeaturesData,
    subtotal, discount, channelDiscount, discountPercent, total, vat, grandTotal, vatOption,
    tierData, tierSetupOf, tierMonthlyOf,
    monthlyTotal: getMonthlyTotal(),
    customerName, customerPhone, customerEmail, notes,
    handlePrint, updateCustomerName, updateCustomerPhone, updateCustomerEmail, updateNotes, updateDueDate,
    formatPrice,
  };
}
