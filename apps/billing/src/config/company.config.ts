/**
 * Company Configuration
 * 
 * Single source of truth for company information.
 * Update this file to change company details, contacts, and payment info.
 * 
 * ⚠️ Changes here will affect:
 * - QuoteView, InvoiceView, ReceiptView (signatures, headers)
 * - Contact pages
 * - Payment sections
 */

/**
 * Company Information
 */
export const COMPANY_INFO = {
  /** Official company name (English) */
  name: 'CleanCode 1986 Co., Ltd.',
  /** Official company name (Thai) */
  nameTH: 'บริษัท คลีนโค้ด 1986 จำกัด',
  /** Short display name */
  shortName: 'CleanCode1986',
  /** Product name */
  productName: 'OmniChat',
  /** Company tagline */
  tagline: 'รวมแชททุกช่องทางไว้ในจอเดียว',
  /** Company phone */
  phone: '089-484-7773',
  /** Primary email */
  email: 'marosdee.fuzana@gmail.com',
  /** LINE ID */
  lineId: '@marosdee7',
  /** Website URL */
  website: 'https://cleancode1986-portfolio.vercel.app/',
} as const;

/**
 * Bank Account Information for Payments
 */
export const BANK_ACCOUNTS = [
  {
    id: 'kasikorn',
    bankName: 'ธนาคารกสิกรไทย',
    bankNameEN: 'Kasikorn Bank',
    accountNo: '727-2-71761-8',
    accountName: 'มะรอสดี อุมา',
    icon: '🏦',
  },
] as const;

/**
 * PromptPay Information
 */
export const PROMPTPAY_INFO = {
  number: '1960500086397',
  name: 'มะรอสดี อุมา',
  icon: '📱',
} as const;

/**
 * Payment Contact Information
 */
export const PAYMENT_CONTACT = {
  email: 'marosdee.fuzana@gmail.com',
  lineId: '@marosdee7',
  instruction: 'กรุณาส่งหลักฐานการโอนเงินมาที่ marosdee.fuzana@gmail.com หรือ LINE: @marosdee7',
} as const;

/**
 * Get primary bank account
 */
export function getPrimaryBankAccount() {
  return BANK_ACCOUNTS[0];
}

/**
 * Export type for company config
 */
export type CompanyConfig = {
  company: typeof COMPANY_INFO;
  banks: typeof BANK_ACCOUNTS;
  promptPay: typeof PROMPTPAY_INFO;
  paymentContact: typeof PAYMENT_CONTACT;
};
