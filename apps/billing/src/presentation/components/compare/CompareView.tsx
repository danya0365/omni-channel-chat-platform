'use client';

import { COMPANY_INFO } from '@/src/config/company.config';
import { QUOTE_TERMS } from '@/src/config/quotation.config';
import { CompareControls } from '@/src/presentation/components/compare/CompareControls';
import { PackageComparisonTable } from '@/src/presentation/components/compare/PackageComparisonTable';
import { useComparePresenter } from '@/src/presentation/hooks/useComparePresenter';

/**
 * CompareView
 * ใบเสนอราคาแบบเทียบ 3 แพ็กเกจในใบเดียว — ให้ลูกค้าเห็นภาพรวมทีเดียวแล้วชี้เลือก
 * (ต่างจาก /quote ที่เสนอชุดฟีเจอร์ชุดเดียวแบบละเอียด)
 */
export function CompareView() {
  const {
    printRef, hasContent,
    quoteNumber, quoteDate, validUntil, isDocumentReady, reissueNumber,
    projectType, projectTypeData, projectTypes,
    deliveryTier, tierData, deliveryTiers,
    vatOption,
    packageColumns, comparisonRows,
    customerName, customerPhone, customerEmail, notes,
    setProjectType, setDeliveryTier, setVatOption,
    updateCustomerName, updateCustomerPhone, updateCustomerEmail, updateNotes,
    handlePrint,
    formatPrice,
  } = useComparePresenter();

  return (
    <div className="doc-page">
      {/* Action Bar */}
      <div className="doc-actions print-hidden">
        <a href="/builder" className="app-btn app-btn-ghost">← กลับไป Builder</a>
        <div className="doc-actions-right">
          <a href="/quote" className="app-btn app-btn-secondary">📋 ใบเสนอราคาเดี่ยว</a>
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
            disabled={!hasContent || !isDocumentReady}
          >
            🖨️ พิมพ์ใบเทียบแพ็กเกจ
          </button>
        </div>
      </div>

      <CompareControls
        projectTypes={projectTypes}
        projectType={projectType}
        onProjectTypeChange={setProjectType}
        deliveryTiers={deliveryTiers}
        deliveryTier={deliveryTier}
        onDeliveryTierChange={setDeliveryTier}
        vatOption={vatOption}
        onVatOptionChange={setVatOption}
      />

      {!hasContent ? (
        <div className="doc-empty">
          <div className="doc-empty-content">
            <h2>เลือกประเภทธุรกิจของลูกค้าก่อน</h2>
            <p>ระบบจะดึงแพ็กเกจที่เหมาะกับธุรกิจนั้นมาเทียบให้อัตโนมัติ 3 แบบ</p>
          </div>
        </div>
      ) : (
        <div ref={printRef} className="doc-document">
          {/* Header */}
          <header className="doc-header">
            <div>
              <h1 className="doc-company-name">
                <span style={{ color: 'var(--color-primary)' }}>Omni</span>
                <span>Chat</span>
              </h1>
              <p className="doc-company-sub">{COMPANY_INFO.tagline}</p>
              <div className="doc-badge doc-badge-quote">📋 ใบเสนอราคา — เทียบแพ็กเกจ</div>
            </div>
            <div className="doc-meta">
              <div className="doc-meta-item">
                <span className="doc-meta-label">เลขที่</span>
                <span className="doc-meta-value">{quoteNumber || '—'}</span>
              </div>
              <div className="doc-meta-item">
                <span className="doc-meta-label">วันที่</span>
                <span className="doc-meta-value">{quoteDate}</span>
              </div>
              <div className="doc-meta-item">
                <span className="doc-meta-label">ใช้ได้ถึง</span>
                <span className="doc-meta-value" style={{ color: '#dc2626', fontWeight: 600 }}>
                  {validUntil}
                </span>
              </div>
            </div>
          </header>

          {/* Customer Info (editable) */}
          <section className="doc-customer print-hidden">
            <h3 className="doc-section-title">ข้อมูลลูกค้า</h3>
            <div className="doc-customer-form">
              <input
                type="text" placeholder="ชื่อบริษัท/ร้านค้า" className="doc-input"
                value={customerName} onChange={(e) => updateCustomerName(e.target.value)}
              />
              <input
                type="tel" placeholder="เบอร์โทรศัพท์" className="doc-input"
                value={customerPhone} onChange={(e) => updateCustomerPhone(e.target.value)}
              />
              <input
                type="email" placeholder="อีเมล" className="doc-input"
                value={customerEmail} onChange={(e) => updateCustomerEmail(e.target.value)}
              />
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

          {/* บริบทที่ทำให้ราคาในใบนี้เป็นแบบนี้ */}
          <section className="doc-section">
            <h3 className="doc-section-title">เงื่อนไขที่ใช้คิดราคาในใบนี้</h3>
            <div className="cmp-context">
              {projectTypeData && (
                <div className="doc-project-type">
                  <span className="icon">{projectTypeData.icon}</span>
                  <span className="name">{projectTypeData.name}</span>
                  <span className="name-en">({projectTypeData.nameEn})</span>
                </div>
              )}
              {tierData && (
                <div className="doc-project-type">
                  <span className="icon">{tierData.icon}</span>
                  <span className="name">{tierData.name}</span>
                  <span className="name-en">({tierData.nameEn})</span>
                </div>
              )}
            </div>
            {tierData && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
                {tierData.detail}
              </p>
            )}
          </section>

          {/* ตารางเทียบ */}
          <section className="doc-section">
            <h3 className="doc-section-title">เทียบแพ็กเกจ</h3>
            <PackageComparisonTable
              columns={packageColumns}
              rows={comparisonRows}
              vatIncluded={vatOption === 'include'}
              formatPrice={formatPrice}
            />
            <p className="cmp-footnote">
              ★ ทุกแพ็กเกจ <strong>ไม่คิดค่าใช้งานรายหัว</strong> — เพิ่มทีมตอบแชทกี่คน
              ค่าบริการรายเดือนก็เท่าเดิม
            </p>
          </section>

          {/* Notes */}
          <section className="doc-notes">
            <h3 className="doc-section-title">หมายเหตุ</h3>
            <textarea
              placeholder="เพิ่มหมายเหตุหรือเงื่อนไขพิเศษ..."
              value={notes} onChange={(e) => updateNotes(e.target.value)}
              className="doc-input print-hidden" rows={3}
            />
            {notes && (
              <p className="print-show" style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
                {notes}
              </p>
            )}
            <ul className="doc-terms">
              {QUOTE_TERMS.map((term, idx) => (
                <li key={idx}>{term}</li>
              ))}
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
      )}
    </div>
  );
}
