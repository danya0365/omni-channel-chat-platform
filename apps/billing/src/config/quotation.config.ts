/**
 * Quotation Configuration
 * 
 * Single source of truth for quotation-related settings.
 * Update this file to change VAT rates, validity periods, and document terms.
 * 
 * ⚠️ Changes here will affect:
 * - useQuotePresenter, useInvoicePresenter, useReceiptPresenter
 * - SummaryPanel (VAT calculations)
 * - QuoteView, InvoiceView, ReceiptView (terms & conditions)
 */

/**
 * VAT Configuration
 */
export const VAT_CONFIG = {
  /** VAT rate (e.g., 0.07 = 7%) */
  rate: 0.07,
  /** VAT percentage for display */
  ratePercent: 7,
  /** Multiplier for total with VAT (e.g., 1.07) */
  multiplier: 1.07,
} as const;

/**
 * Document Validity Periods
 */
export const DOCUMENT_VALIDITY = {
  /** Quote valid for N days */
  quoteValidDays: 30,
  /** Invoice due in N days */
  invoiceDueDays: 7,
  /** Late payment interest rate (monthly) */
  latePaymentInterestPercent: 1.5,
} as const;

/**
 * Quote Terms & Conditions
 */
export const QUOTE_TERMS = [
  `ราคานี้มีผล ${DOCUMENT_VALIDITY.quoteValidDays} วันนับจากวันที่ออกใบเสนอราคา`,
  'ราคาอิงรูปแบบการจ้างที่เลือกไว้ในใบนี้ — เปลี่ยนรูปแบบทีม ราคาจะเปลี่ยนตาม',
  'ช่องทางมาตรฐาน (เว็บ/LINE/Messenger/Instagram/Telegram/อีเมล): ช่องทางที่ 2 เป็นต้นไปลด 30% และรวมกันไม่เกิน 10,000 บาท',
  'ช่องทางพิเศษ (WhatsApp/TikTok/Shopee-Lazada/สั่งทำ) คิดราคาแยก ไม่เข้าส่วนลดและเพดานข้างต้น เพราะต้นทุนหลักคือการขออนุมัติจากผู้ให้บริการ',
  'ช่องทางที่ต้องผ่านการอนุมัติจากผู้ให้บริการ (Meta App Review, WhatsApp Business, Shopee/Lazada Open Platform) ระยะเวลาขึ้นกับผู้ให้บริการ อยู่นอกเหนือการควบคุมของเรา',
  'ค่าติดตั้ง (ครั้งเดียว) รวม: วางระบบ, เชื่อมช่องทางที่เลือก, ทดสอบ และส่งมอบ',
  'ค่าบริการรายเดือน ครอบคลุม: hosting, ค่าเชื่อมต่อช่องทาง, การดูแลระบบและอัปเดต',
  'ส่วนลดในใบเสนอราคานี้ใช้กับค่าติดตั้งเท่านั้น — ค่าบริการรายเดือนคิดตามจริง',
  'เงื่อนไขการชำระค่าติดตั้ง: 50% เมื่อตกลง, 50% เมื่อส่งมอบงาน',
  'ค่าบริการรายเดือนเริ่มเก็บเดือนถัดจากวันส่งมอบ ชำระล่วงหน้าเป็นรายเดือน',
  'ค่าธรรมเนียมของผู้ให้บริการช่องทาง (เช่น LINE OA, WhatsApp API) ลูกค้าเป็นผู้รับผิดชอบตามจริง',
] as const;

/**
 * Invoice Terms & Conditions
 */
export const INVOICE_TERMS = [
  'กรุณาชำระเงินภายในวันครบกำหนด',
  `หากพ้นกำหนด บริษัทฯ ขอสงวนสิทธิ์คิดดอกเบี้ย ${DOCUMENT_VALIDITY.latePaymentInterestPercent}% ต่อเดือน`,
] as const;

/**
 * Document Number Prefixes
 */
export const DOCUMENT_PREFIXES = {
  quote: 'OQ',
  invoice: 'INV',
  receipt: 'RC',
} as const;

/**
 * Calculate VAT amount from total
 */
export function calculateVAT(total: number): number {
  return Math.round(total * VAT_CONFIG.rate);
}

/**
 * Calculate grand total with VAT
 */
export function calculateGrandTotal(total: number): number {
  return Math.round(total * VAT_CONFIG.multiplier);
}

/**
 * Export type for quotation config
 */
export type QuotationConfig = {
  vat: typeof VAT_CONFIG;
  validity: typeof DOCUMENT_VALIDITY;
  quoteTerms: typeof QUOTE_TERMS;
  invoiceTerms: typeof INVOICE_TERMS;
  prefixes: typeof DOCUMENT_PREFIXES;
};
