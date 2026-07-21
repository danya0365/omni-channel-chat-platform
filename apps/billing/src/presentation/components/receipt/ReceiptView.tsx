'use client';

import { COMPANY_INFO } from '@/src/config/company.config';
import { VAT_CONFIG } from '@/src/config/quotation.config';
import {
  getCategoryById,
  MULTI_CHANNEL_DISCOUNT_PERCENT,
  STANDARD_CHANNEL_CAP,
} from '@/src/data/mock/mockFeatures';
import { useReceiptPresenter } from '@/src/presentation/hooks/useReceiptPresenter';

/**
 * ReceiptView Component
 * Print-friendly receipt view for payment confirmation
 */
export function ReceiptView() {
  const {
    printRef, hasContent,
    receiptNumber, receiptDate,
    projectTypeData, selectedFeaturesData,
    subtotal, discount, channelDiscount, discountPercent, total, vat, grandTotal, vatOption,
    customerName, customerPhone, customerEmail, notes,
    paymentMethod, paymentReference, paidDate, formattedPaidDate,
    handlePrint, updateCustomerName, updateCustomerPhone, updateCustomerEmail, updateNotes,
    updatePaymentMethod, updatePaymentReference, updatePaidDate,
    tierData, tierSetupOf,
    formatPrice,
  } = useReceiptPresenter();

  // Flatten all features for a compact receipt (คูณ tier ตรงนี้ที่เดียว)
  const allFeatures = selectedFeaturesData.map(feature => {
    const category = getCategoryById(feature.categoryId);
    return { ...feature, price: tierSetupOf(feature.price), categoryName: category?.name ?? 'อื่นๆ' };
  });

  const MAX_VISIBLE = 10;
  const baseCount = projectTypeData ? 1 : 0;
  const totalItems = baseCount + allFeatures.length;
  const needsCollapse = totalItems > MAX_VISIBLE;
  const maxShow = needsCollapse ? MAX_VISIBLE - baseCount - 1 : allFeatures.length;
  const visible = allFeatures.slice(0, maxShow);
  const collapsed = allFeatures.slice(maxShow);
  const collapsedTotal = collapsed.reduce((s, f) => s + f.price, 0);

  if (!hasContent) {
    return (
      <div className="doc-empty">
        <div className="doc-empty-content">
          <span>🧾</span>
          <h2>ยังไม่มีรายการ</h2>
          <p>กรุณาเลือกประเภทธุรกิจและฟีเจอร์ใน Builder ก่อน</p>
          <a href="/builder" className="app-btn app-btn-primary">ไปที่ Builder</a>
        </div>
      </div>
    );
  }

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'เงินสด', transfer: 'โอนเงิน', credit: 'บัตรเครดิต',
    promptpay: 'PromptPay', cheque: 'เช็ค',
  };

  return (
    <div className="doc-page">
      {/* Action Bar */}
      <div className="doc-actions print-hidden">
        <a href="/builder" className="app-btn app-btn-ghost">← กลับไป Builder</a>
        <div className="doc-actions-right">
          <a href="/quote" className="app-btn app-btn-secondary">📋 ใบเสนอราคา</a>
          <a href="/invoice" className="app-btn app-btn-secondary">📝 ใบแจ้งหนี้</a>
          <button onClick={() => handlePrint()} className="app-btn app-btn-primary">🖨️ พิมพ์ใบเสร็จ</button>
        </div>
      </div>

      {/* Document */}
      <div ref={printRef} className="doc-document">
        {/* Header */}
        <header className="doc-header">
          <div>
            <h1 className="doc-company-name">
              <span style={{ color: '#16a34a' }}>Omni</span>
              <span>Chat</span>
            </h1>
            <p className="doc-company-sub">รวมแชททุกช่องทางไว้ในจอเดียว</p>
            <div className="doc-badge doc-badge-receipt">✅ ใบเสร็จรับเงิน</div>
            {tierData && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.35rem' }}>
                รูปแบบการจ้าง: {tierData.icon} {tierData.name}
              </p>
            )}
          </div>
          <div className="doc-meta">
            <div className="doc-meta-item">
              <span className="doc-meta-label">เลขที่ใบเสร็จ</span>
              <span className="doc-meta-value">{receiptNumber}</span>
            </div>
            <div className="doc-meta-item">
              <span className="doc-meta-label">วันที่ออก</span>
              <span className="doc-meta-value">{receiptDate}</span>
            </div>
            <div className="doc-meta-item">
              <span className="doc-meta-label">วันที่ชำระ</span>
              <span className="doc-meta-value" style={{ color: '#16a34a' }}>{formattedPaidDate}</span>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <span className="doc-status-badge doc-status-paid">✓ ชำระแล้ว</span>
            </div>
          </div>
        </header>

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
            <h3 className="doc-section-title">ได้รับเงินจาก</h3>
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

        {/* Compact Features Table */}
        <section className="doc-section">
          <h3 className="doc-section-title">รายการ</h3>
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
                  <td className="text-center">1</td>
                  <td>
                    <div className="font-semibold">ค่าวางระบบพื้นฐาน ({projectTypeData.name})</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>รวม setup, widget เว็บ, กล่องข้อความรวม, realtime และ routing พื้นฐาน</div>
                  </td>
                  <td className="text-center">-</td>
                  <td className="text-right font-mono">฿{tierSetupOf(projectTypeData.basePrice).toLocaleString()}</td>
                </tr>
              )}
              {visible.map((feature, idx) => (
                <tr key={feature.id}>
                  <td className="text-center">{baseCount + idx + 1}</td>
                  <td><div className="font-medium">{feature.name}</div></td>
                  <td className="text-center">
                    <span className={`doc-level level-${feature.level}`}>
                      {feature.level.charAt(0).toUpperCase() + feature.level.slice(1)}
                    </span>
                  </td>
                  <td className="text-right font-mono">{feature.price === 0 ? 'รวมในแพ็กเกจ' : formatPrice(feature.price)}</td>
                </tr>
              ))}
              {needsCollapse && collapsed.length > 0 && (
                <tr className="category-row">
                  <td className="text-center">{baseCount + visible.length + 1}</td>
                  <td>
                    <div className="font-semibold">รายการอื่นๆ อีก {collapsed.length} รายการ</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{collapsed.map(f => f.name).join(', ')}</div>
                  </td>
                  <td className="text-center">-</td>
                  <td className="text-right font-mono font-semibold">{collapsedTotal === 0 ? 'รวมในแพ็กเกจ' : formatPrice(collapsedTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
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
              💰 {vatOption === 'include' && 'ยอดที่ชำระแล้ว'}
              {vatOption === 'exclude' && 'ยอดที่ชำระแล้ว (ไม่รวม VAT)'}
              {vatOption === 'exempt' && 'ยอดที่ชำระแล้ว (ไม่คิด VAT)'}
            </span>
            <span className="font-mono amount-receipt">{formatPrice(grandTotal)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <section className="doc-payment">
          <h3 className="doc-section-title">ข้อมูลการชำระเงิน</h3>
          {/* Editable */}
          <div className="doc-payment-form print-hidden">
            <div>
              <label className="doc-label">วันที่ชำระ</label>
              <input type="date" value={paidDate} onChange={e => updatePaidDate(e.target.value)} className="doc-input" />
            </div>
            <div>
              <label className="doc-label">ช่องทางชำระ</label>
              <select value={paymentMethod} onChange={e => updatePaymentMethod(e.target.value)} className="doc-input">
                <option value="">เลือกช่องทาง</option>
                <option value="cash">เงินสด</option>
                <option value="transfer">โอนเงิน</option>
                <option value="credit">บัตรเครดิต</option>
                <option value="promptpay">PromptPay</option>
                <option value="cheque">เช็ค</option>
              </select>
            </div>
            <div>
              <label className="doc-label">เลขอ้างอิง/หมายเหตุ</label>
              <input type="text" placeholder="เลขที่บัญชี, เลขอ้างอิง ฯลฯ" value={paymentReference} onChange={e => updatePaymentReference(e.target.value)} className="doc-input" />
            </div>
          </div>
          {/* Print version */}
          <div className="print-show">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
              <div><span style={{ color: 'var(--color-muted)' }}>วันที่ชำระ:</span> <span style={{ fontWeight: 500 }}>{formattedPaidDate}</span></div>
              {paymentMethod && <div><span style={{ color: 'var(--color-muted)' }}>ช่องทาง:</span> <span style={{ fontWeight: 500 }}>{PAYMENT_LABELS[paymentMethod] || paymentMethod}</span></div>}
              {paymentReference && <div><span style={{ color: 'var(--color-muted)' }}>เลขอ้างอิง:</span> <span style={{ fontWeight: 500 }}>{paymentReference}</span></div>}
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="doc-notes">
          <h3 className="doc-section-title">หมายเหตุ</h3>
          <textarea
            placeholder="เพิ่มหมายเหตุ..."
            value={notes} onChange={e => updateNotes(e.target.value)}
            className="doc-input print-hidden" rows={2}
          />
          {notes && <p className="print-show" style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>{notes}</p>}
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
            เอกสารนี้เป็นหลักฐานการรับเงินที่ออกโดยระบบ OmniChat
          </p>
        </section>

        {/* Footer */}
        <footer className="doc-footer">
          <div className="doc-signature">
            <div className="doc-signature-box">
              <div className="doc-signature-line" />
              <p>ผู้รับเงิน</p>
              <p className="sub">{COMPANY_INFO.name}</p>
            </div>
            <div className="doc-signature-box">
              <div className="doc-signature-line" />
              <p>ผู้ชำระเงิน</p>
              <p className="sub">ลูกค้า</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
