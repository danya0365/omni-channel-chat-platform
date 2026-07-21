'use client';

import { DOCUMENT_PREFIXES, VAT_CONFIG } from '@/src/config/quotation.config';
import { formatPrice, getProjectTypeById, tierMonthly, tierSetup } from '@/src/data/mock/mockFeatures';
import { useQuotationStore } from '@/src/presentation/store/quotationStore';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';

/**
 * useReceiptPresenter Hook
 * Handles all business logic for ReceiptView
 */
export function useReceiptPresenter() {
  const {
    deliveryTier, projectType, selectedFeatures, discountPercent, vatOption,
    customerName, customerPhone, customerEmail, notes,
    getSubtotal, getDiscount, getChannelDiscount, getTotal, getTierData, getSelectedFeaturesData,
    setCustomerInfo, setNotes,
  } = useQuotationStore();

  const tierData = getTierData();
  const tierSetupOf = useCallback((amount: number) => tierSetup(amount, deliveryTier), [deliveryTier]);
  const tierMonthlyOf = useCallback((amount: number) => tierMonthly(amount, deliveryTier), [deliveryTier]);

  const printRef = useRef<HTMLDivElement>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paidDate, setPaidDate] = useState(dayjs().format('YYYY-MM-DD'));

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

  const receiptNumber = useMemo(() => {
    const now = dayjs();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${DOCUMENT_PREFIXES.receipt}-${now.format('YYYYMMDD')}-${random}`;
  }, []);

  const receiptDate = useMemo(() => dayjs().locale('th').format('D MMMM YYYY'), []);
  const formattedPaidDate = useMemo(
    () => dayjs(paidDate).locale('th').format('D MMMM YYYY'),
    [paidDate]
  );

  const hasContent = !!(projectType || selectedFeatures.length > 0);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบเสร็จรับเงิน-${receiptNumber}`,
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
  const updatePaymentMethod = useCallback((val: string) => setPaymentMethod(val), []);
  const updatePaymentReference = useCallback((val: string) => setPaymentReference(val), []);
  const updatePaidDate = useCallback((val: string) => setPaidDate(val), []);

  return {
    printRef, hasContent,
    receiptNumber, receiptDate,
    projectType, projectTypeData,
    selectedFeatures, selectedFeaturesData,
    subtotal, discount, channelDiscount, discountPercent, total, vat, grandTotal, vatOption,
    tierData, tierSetupOf, tierMonthlyOf,
    customerName, customerPhone, customerEmail, notes,
    paymentMethod, paymentReference, paidDate, formattedPaidDate,
    handlePrint, updateCustomerName, updateCustomerPhone, updateCustomerEmail, updateNotes,
    updatePaymentMethod, updatePaymentReference, updatePaidDate,
    formatPrice,
  };
}
