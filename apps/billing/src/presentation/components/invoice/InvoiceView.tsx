'use client';

import { COMPANY_INFO, PAYMENT_CONTACT, PROMPTPAY_INFO, getPrimaryBankAccount } from '@/src/config/company.config';
import { INVOICE_TERMS, VAT_CONFIG } from '@/src/config/quotation.config';
import {
  getCategoryById,
  MULTI_CHANNEL_DISCOUNT_PERCENT,
  STANDARD_CHANNEL_CAP,
} from '@/src/data/mock/mockFeatures';
import { useInvoicePresenter } from '@/src/presentation/hooks/useInvoicePresenter';
import { Fragment } from 'react';

/**
 * InvoiceView Component
 * Print-friendly invoice view with payment details
 */
export function InvoiceView() {
  const {
    printRef, hasContent,
    invoiceNumber, invoiceDate, dueDate, formattedDueDate, isDocumentReady, reissueNumber,
    projectTypeData, selectedFeaturesData,
    subtotal, discount, channelDiscount, discountPercent, total, vat, grandTotal, vatOption, monthlyTotal,
    tierData, tierSetupOf,
    customerName, customerPhone, customerEmail, notes,
    handlePrint, updateCustomerName, updateCustomerPhone, updateCustomerEmail, updateNotes, updateDueDate,
    formatPrice,
  } = useInvoicePresenter();

  // คูณ tier ให้เสร็จก่อนส่งเข้าตาราง
  const tieredFeatures = selectedFeaturesData.map((f) => ({ ...f, price: tierSetupOf(f.price) }));
  const tieredProjectType = projectTypeData
    ? { ...projectTypeData, basePrice: tierSetupOf(projectTypeData.basePrice) }
    : projectTypeData;

  const groupedFeatures = tieredFeatures.reduce((acc, feature) => {
    const category = getCategoryById(feature.categoryId);
    const categoryName = category?.name ?? 'อื่นๆ';
    if (!acc[categoryName]) acc[categoryName] = [];
    acc[categoryName].push(feature);
    return acc;
  }, {} as Record<string, typeof tieredFeatures>);

  if (!hasContent) {
    return (
      <div className="doc-empty">
        <div className="doc-empty-content">
          <span>📝</span>
          <h2>ยังไม่มีรายการ</h2>
          <p>กรุณาเลือกประเภทธุรกิจและฟีเจอร์ใน Builder ก่อน</p>
          <a href="/builder" className="app-btn app-btn-primary">ไปที่ Builder</a>
        </div>
      </div>
    );
  }

  const bank = getPrimaryBankAccount();

  return (
    <div className="doc-page">
      {/* Action Bar */}
      <div className="doc-actions print-hidden">
        <a href="/builder" className="app-btn app-btn-ghost">← กลับไป Builder</a>
        <div className="doc-actions-right">
          <a href="/quote" className="app-btn app-btn-secondary">📋 ใบเสนอราคา</a>
          <a href="/receipt" className="app-btn app-btn-secondary">🧾 ใบเสร็จ</a>
          <button
            onClick={reissueNumber}
            className="app-btn app-btn-ghost"
            title="เดินเลขที่เอกสารเป็นใบถัดไป (ใช้ตอนออกใบให้ลูกค้ารายใหม่)"
          >
            🔄 ออกเลขใหม่
          </button>
          <button
            onClick={() => handlePrint()}
            className="app-btn app-btn-primary"
            disabled={!isDocumentReady}
          >
            🖨️ พิมพ์ใบแจ้งหนี้
          </button>
        </div>
      </div>

      {/* Document */}
      <div ref={printRef} className="doc-document">
        {/* Header */}
        <header className="doc-header">
          <div>
            <h1 className="doc-company-name">
              <span style={{ color: '#d97706' }}>Omni</span>
              <span>Chat</span>
            </h1>
            <p className="doc-company-sub">รวมแชททุกช่องทางไว้ในจอเดียว</p>
            <div className="doc-badge doc-badge-invoice">📝 ใบแจ้งหนี้</div>
            {tierData && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.35rem' }}>
                รูปแบบการจ้าง: {tierData.icon} {tierData.name}
              </p>
            )}
          </div>
          <div className="doc-meta">
            <div className="doc-meta-item">
              <span className="doc-meta-label">เลขที่ใบแจ้งหนี้</span>
              <span className="doc-meta-value">{invoiceNumber || '—'}</span>
            </div>
            <div className="doc-meta-item">
              <span className="doc-meta-label">วันที่ออก</span>
              <span className="doc-meta-value">{invoiceDate}</span>
            </div>
            <div className="doc-meta-item">
              <span className="doc-meta-label">ครบกำหนดชำระ</span>
              <span className="doc-meta-value" style={{ color: '#d97706', fontWeight: 700 }}>{formattedDueDate}</span>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <span className="doc-status-badge doc-status-pending">⏳ รอชำระเงิน</span>
            </div>
          </div>
        </header>

        {/* Due Date Editor */}
        <section className="print-hidden" style={{ marginBottom: '1.5rem' }}>
          <label className="doc-label">วันครบกำหนดชำระ</label>
          <input type="date" value={dueDate} onChange={e => updateDueDate(e.target.value)} className="doc-input" style={{ width: 'auto' }} />
        </section>

        {/* Customer Info (editable) */}
        <section className="doc-customer print-hidden">
          <h3 className="doc-section-title">ข้อมูลลูกค้า</h3>
          <div className="doc-customer-form">
            <input type="text" placeholder="ชื่อบริษัท/ร้านค้า" value={customerName} onChange={e => updateCustomerName(e.target.value)} className="doc-input" />
            <input type="tel" placeholder="เบอร์โทรศัพท์" value={customerPhone} onChange={e => updateCustomerPhone(e.target.value)} className="doc-input" />
            <input type="email" placeholder="อีเมล" value={customerEmail} onChange={e => updateCustomerEmail(e.target.value)} className="doc-input" />
          </div>
        </section>

        {/* Customer Info (print) */}
        {(customerName || customerPhone || customerEmail) && (
          <section className="print-show" style={{ marginBottom: '1.5rem' }}>
            <h3 className="doc-section-title">เรียกเก็บเงินจาก</h3>
            {customerName && <p style={{ fontWeight: 600 }}>{customerName}</p>}
            {customerPhone && <p>โทร: {customerPhone}</p>}
            {customerEmail && <p>อีเมล: {customerEmail}</p>}
          </section>
        )}

        {/* Project Type */}
        {projectTypeData && (
          <section className="doc-section">
            <h3 className="doc-section-title">ประเภทธุรกิจ</h3>
            <div className="doc-project-type">
              <span className="icon">{projectTypeData.icon}</span>
              <span className="name">{projectTypeData.name}</span>
              <span className="name-en">({projectTypeData.nameEn})</span>
            </div>
          </section>
        )}

        {/* Features Table */}
        <section className="doc-section">
          <h3 className="doc-section-title">รายการฟีเจอร์</h3>
          <FeaturesTable projectTypeData={tieredProjectType} groupedFeatures={groupedFeatures} formatPrice={formatPrice} />
        </section>

        {/* Summary */}
        <div className="doc-summary">
          <div className="doc-summary-row">
            <span>รวมค่าติดตั้ง</span>
            <span className="font-mono">{formatPrice(subtotal)}</span>
          </div>
          {channelDiscount > 0 && (
            <div className="doc-summary-row discount">
              <span>ส่วนลดชุดช่องทางมาตรฐาน (ช่องทางที่ 2 เป็นต้นไป -{MULTI_CHANNEL_DISCOUNT_PERCENT}% · รวมไม่เกิน {formatPrice(STANDARD_CHANNEL_CAP)})</span>
              <span className="font-mono">-{formatPrice(channelDiscount)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="doc-summary-row discount">
              <span>ส่วนลด {discountPercent > 0 ? `(${discountPercent}%)` : ''}</span>
              <span className="font-mono">-{formatPrice(discount)}</span>
            </div>
          )}
          <div className="doc-summary-row total">
            <span>ราคาสุทธิ {vatOption === 'include' ? '(ก่อน VAT)' : ''}</span>
            <span className="font-mono">{formatPrice(total)}</span>
          </div>
          {vatOption === 'include' && (
            <div className="doc-summary-row">
              <span>VAT {VAT_CONFIG.ratePercent}%</span>
              <span className="font-mono">{formatPrice(vat)}</span>
            </div>
          )}
          <div className="doc-summary-row grand-total">
            <span>
              💰 {vatOption === 'include' && 'ยอดที่ต้องชำระ'}
              {vatOption === 'exclude' && 'ยอดที่ต้องชำระ (ไม่รวม VAT)'}
              {vatOption === 'exempt' && 'ยอดที่ต้องชำระ (ไม่คิด VAT)'}
            </span>
            <span className="font-mono amount-invoice">{formatPrice(grandTotal)}</span>
          </div>
        </div>

        {monthlyTotal > 0 && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '0.75rem' }}>
            * ใบแจ้งหนี้นี้เรียกเก็บ <strong>ค่าติดตั้ง (ครั้งเดียว)</strong> เท่านั้น —
            ค่าบริการรายเดือน {formatPrice(monthlyTotal)}/เดือน จะเรียกเก็บแยกตามรอบบิล
            เริ่มเดือนถัดจากวันส่งมอบ
          </p>
        )}

        {/* Payment Info */}
        <section className="doc-payment">
          <h3 className="doc-section-title">ช่องทางการชำระเงิน</h3>
          <div className="doc-payment-grid">
            <div className="doc-payment-method">
              <div className="doc-payment-method-title">{bank.icon} โอนเงินผ่านธนาคาร</div>
              <div className="doc-payment-method-content">
                <p><strong>ธนาคาร:</strong> {bank.bankName}</p>
                <p><strong>เลขบัญชี:</strong> {bank.accountNo}</p>
                <p><strong>ชื่อบัญชี:</strong> {bank.accountName}</p>
              </div>
            </div>
            <div className="doc-payment-method">
              <div className="doc-payment-method-title">{PROMPTPAY_INFO.icon} PromptPay</div>
              <div className="doc-payment-method-content">
                <p><strong>เลขพร้อมเพย์:</strong> {PROMPTPAY_INFO.number}</p>
                <p><strong>ชื่อ:</strong> {PROMPTPAY_INFO.name}</p>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '1rem' }}>{PAYMENT_CONTACT.instruction}</p>
        </section>

        {/* Notes */}
        <section className="doc-notes">
          <h3 className="doc-section-title">หมายเหตุ</h3>
          <textarea
            placeholder="เพิ่มหมายเหตุหรือเงื่อนไขพิเศษ..."
            value={notes} onChange={e => updateNotes(e.target.value)}
            className="doc-input print-hidden" rows={3}
          />
          {notes && <p className="print-show" style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>{notes}</p>}
          <ul className="doc-terms">
            {INVOICE_TERMS.map((term, idx) => <li key={idx}>{term}</li>)}
            <li>หากมีข้อสงสัย กรุณาติดต่อ {COMPANY_INFO.phone}</li>
          </ul>
        </section>

        {/* Footer */}
        <footer className="doc-footer">
          <div className="doc-signature">
            <div className="doc-signature-box">
              <div className="doc-signature-line" />
              <p>ผู้ออกใบแจ้งหนี้</p>
              <p className="sub">{COMPANY_INFO.name}</p>
            </div>
            <div className="doc-signature-box">
              <div className="doc-signature-line" />
              <p>ผู้รับใบแจ้งหนี้</p>
              <p className="sub">ลูกค้า</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── Features Table Sub-component ── */
interface FeaturesTableProps {
  projectTypeData: { icon: string; name: string; basePrice: number } | null | undefined;
  groupedFeatures: Record<string, { id: string; name: string; description: string; level: string; price: number }[]>;
  formatPrice: (price: number) => string;
}

function FeaturesTable({ projectTypeData, groupedFeatures, formatPrice }: FeaturesTableProps) {
  let rowIndex = 0;
  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th className="text-center" style={{ width: '2.5rem' }}>#</th>
          <th>รายการ</th>
          <th className="text-center" style={{ width: '5rem' }}>Level</th>
          <th className="text-right" style={{ width: '7rem' }}>ค่าติดตั้ง (บาท)</th>
        </tr>
      </thead>
      <tbody>
        {projectTypeData && (
          <tr>
            <td className="text-center">{++rowIndex}</td>
            <td>
              <div className="font-semibold">ค่าวางระบบพื้นฐาน ({projectTypeData.name})</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>รวม setup, widget เว็บ, กล่องข้อความรวม, realtime และ routing พื้นฐาน</div>
            </td>
            <td className="text-center">-</td>
            <td className="text-right font-mono">฿{projectTypeData.basePrice.toLocaleString()}</td>
          </tr>
        )}
        {Object.entries(groupedFeatures).map(([categoryName, features]) => (
          <Fragment key={categoryName}>
            <tr className="category-row">
              <td colSpan={4} className="font-semibold">{categoryName}</td>
            </tr>
            {features.map(feature => (
              <tr key={feature.id}>
                <td className="text-center">{++rowIndex}</td>
                <td>
                  <div className="font-medium">{feature.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{feature.description}</div>
                </td>
                <td className="text-center">
                  <span className={`doc-level level-${feature.level}`}>
                    {feature.level.charAt(0).toUpperCase() + feature.level.slice(1)}
                  </span>
                </td>
                <td className="text-right font-mono">{feature.price === 0 ? 'รวมในแพ็กเกจ' : formatPrice(feature.price)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
