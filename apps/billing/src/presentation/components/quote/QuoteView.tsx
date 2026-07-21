'use client';

import { COMPANY_INFO } from '@/src/config/company.config';
import { QUOTE_TERMS, VAT_CONFIG } from '@/src/config/quotation.config';
import {
  getCategoryById,
  MULTI_CHANNEL_DISCOUNT_PERCENT,
  STANDARD_CHANNEL_CAP,
} from '@/src/data/mock/mockFeatures';
import { useQuotePresenter } from '@/src/presentation/hooks/useQuotePresenter';
import { Fragment } from 'react';

/**
 * QuoteView Component
 * Print-friendly quotation view for OmniChat platform
 */
export function QuoteView() {
  const {
    printRef, hasContent,
    quoteNumber, quoteDate, validUntil,
    projectTypeData, selectedFeaturesData,
    subtotal, discount, channelDiscount, discountPercent, total, vat, grandTotal, vatOption,
    monthlyTotal, monthlyGrandTotal, firstYearTotal,
    tierData, tierSetupOf, tierMonthlyOf,
    customerName, customerPhone, customerEmail, notes,
    handlePrint, updateCustomerName, updateCustomerPhone, updateCustomerEmail, updateNotes,
    formatPrice,
  } = useQuotePresenter();

  // คูณ tier ให้เสร็จตรงนี้ → ตารางข้างล่างไม่ต้องรู้เรื่องรูปแบบการจ้าง
  const tieredFeatures = selectedFeaturesData.map((f) => ({
    ...f,
    price: tierSetupOf(f.price),
    monthlyPrice: tierMonthlyOf(f.monthlyPrice),
  }));

  const tieredProjectType = projectTypeData
    ? {
        ...projectTypeData,
        basePrice: tierSetupOf(projectTypeData.basePrice),
        monthlyPrice: tierMonthlyOf(projectTypeData.monthlyPrice),
      }
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
          <span>📋</span>
          <h2>ยังไม่มีรายการ</h2>
          <p>กรุณาเลือกประเภทธุรกิจและฟีเจอร์ใน Builder ก่อน</p>
          <a href="/builder" className="app-btn app-btn-primary">ไปที่ Builder</a>
        </div>
      </div>
    );
  }

  return (
    <div className="doc-page">
      {/* Action Bar */}
      <div className="doc-actions print-hidden">
        <a href="/builder" className="app-btn app-btn-ghost">← กลับไป Builder</a>
        <div className="doc-actions-right">
          <a href="/invoice" className="app-btn app-btn-secondary">📝 ใบแจ้งหนี้</a>
          <a href="/receipt" className="app-btn app-btn-secondary">🧾 ใบเสร็จ</a>
          <button onClick={() => handlePrint()} className="app-btn app-btn-primary">🖨️ พิมพ์ใบเสนอราคา</button>
        </div>
      </div>

      {/* Document */}
      <div ref={printRef} className="doc-document">
        {/* Header */}
        <header className="doc-header">
          <div>
            <h1 className="doc-company-name">
              <span style={{ color: 'var(--color-primary)' }}>Omni</span>
              <span>Chat</span>
            </h1>
            <p className="doc-company-sub">รวมแชททุกช่องทางไว้ในจอเดียว</p>
            <div className="doc-badge doc-badge-quote">📋 ใบเสนอราคา</div>
          </div>
          <div className="doc-meta">
            <div className="doc-meta-item">
              <span className="doc-meta-label">เลขที่</span>
              <span className="doc-meta-value">{quoteNumber}</span>
            </div>
            <div className="doc-meta-item">
              <span className="doc-meta-label">วันที่</span>
              <span className="doc-meta-value">{quoteDate}</span>
            </div>
            <div className="doc-meta-item">
              <span className="doc-meta-label">ใช้ได้ถึง</span>
              <span className="doc-meta-value" style={{ color: '#dc2626', fontWeight: 600 }}>{validUntil}</span>
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
            <h3 className="doc-section-title">เรียน</h3>
            {customerName && <p style={{ fontWeight: 600 }}>{customerName}</p>}
            {customerPhone && <p>โทร: {customerPhone}</p>}
            {customerEmail && <p>อีเมล: {customerEmail}</p>}
          </section>
        )}

        {/* Delivery Tier — กระทบราคาทั้งใบ */}
        {tierData && (
          <section className="doc-section">
            <h3 className="doc-section-title">รูปแบบการจ้าง</h3>
            <div className="doc-project-type">
              <span className="icon">{tierData.icon}</span>
              <span className="name">{tierData.name}</span>
              <span className="name-en">({tierData.nameEn})</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
              {tierData.detail}
            </p>
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
          <h3 className="doc-section-title">รายการฟีเจอร์ที่เลือก</h3>
          <FeaturesTable projectTypeData={tieredProjectType} groupedFeatures={groupedFeatures} formatPrice={formatPrice} />
        </section>

        {/* Summary */}
        <div className="doc-summary">
          <div className="doc-summary-row">
            <span>รวมค่าติดตั้ง (ครั้งเดียว)</span>
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
              {vatOption === 'include' && 'ยอดค่าติดตั้งรวมทั้งสิ้น'}
              {vatOption === 'exclude' && 'ค่าติดตั้งสุทธิ (ไม่รวม VAT)'}
              {vatOption === 'exempt' && 'ค่าติดตั้งสุทธิ (ไม่คิด VAT)'}
            </span>
            <span className="font-mono amount-quote">{formatPrice(grandTotal)}</span>
          </div>
        </div>

        {/* ค่าบริการรายเดือน — คิดแยกจากค่าติดตั้ง */}
        {monthlyTotal > 0 && (
          <section className="doc-section">
            <h3 className="doc-section-title">ค่าบริการรายเดือน</h3>
            <div className="doc-summary">
              <div className="doc-summary-row">
                <span>ค่าบริการรายเดือน {vatOption === 'include' ? '(ก่อน VAT)' : ''}</span>
                <span className="font-mono">{formatPrice(monthlyTotal)}</span>
              </div>
              {vatOption === 'include' && (
                <div className="doc-summary-row">
                  <span>VAT {VAT_CONFIG.ratePercent}%</span>
                  <span className="font-mono">{formatPrice(monthlyGrandTotal - monthlyTotal)}</span>
                </div>
              )}
              <div className="doc-summary-row grand-total">
                <span>รวมต่อเดือน</span>
                <span className="font-mono amount-quote">{formatPrice(monthlyGrandTotal)}/เดือน</span>
              </div>
              <div className="doc-summary-row total">
                <span>ประมาณการปีแรก (ค่าติดตั้ง + รายเดือน × 12)</span>
                <span className="font-mono">{formatPrice(firstYearTotal)}</span>
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
              * ค่าบริการรายเดือนครอบคลุมค่า hosting, ค่าเชื่อมต่อช่องทาง และการดูแลระบบ —
              เริ่มเก็บเดือนถัดจากวันส่งมอบ · ส่วนลดใช้กับค่าติดตั้งเท่านั้น
            </p>
          </section>
        )}

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
            {QUOTE_TERMS.map((term, idx) => <li key={idx}>{term}</li>)}
          </ul>
        </section>

        {/* Footer */}
        <footer className="doc-footer">
          <div className="doc-signature">
            <div className="doc-signature-box">
              <div className="doc-signature-line" />
              <p>ผู้เสนอราคา</p>
              <p className="sub">{COMPANY_INFO.name}</p>
            </div>
            <div className="doc-signature-box">
              <div className="doc-signature-line" />
              <p>ผู้อนุมัติ</p>
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
  projectTypeData: { icon: string; name: string; basePrice: number; monthlyPrice: number } | null | undefined;
  groupedFeatures: Record<string, { id: string; name: string; description: string; level: string; price: number; monthlyPrice: number }[]>;
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
          <th className="text-right" style={{ width: '7rem' }}>ค่าติดตั้ง</th>
          <th className="text-right" style={{ width: '6rem' }}>รายเดือน</th>
        </tr>
      </thead>
      <tbody>
        {projectTypeData && (
          <tr>
            <td className="text-center">{++rowIndex}</td>
            <td>
              <div className="font-semibold">ค่าวางระบบพื้นฐาน ({projectTypeData.name})</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>รวม setup, widget เว็บ, กล่องข้อความรวม, realtime, routing พื้นฐาน และระบบล็อกอิน</div>
            </td>
            <td className="text-center">-</td>
            <td className="text-right font-mono">฿{projectTypeData.basePrice.toLocaleString()}</td>
            <td className="text-right font-mono">
              {projectTypeData.monthlyPrice === 0 ? '-' : `฿${projectTypeData.monthlyPrice.toLocaleString()}`}
            </td>
          </tr>
        )}
        {Object.entries(groupedFeatures).map(([categoryName, features]) => (
          <Fragment key={categoryName}>
            <tr className="category-row">
              <td colSpan={5} className="font-semibold">{categoryName}</td>
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
                <td className="text-right font-mono">{feature.monthlyPrice === 0 ? '-' : formatPrice(feature.monthlyPrice)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
