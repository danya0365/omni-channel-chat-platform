'use client';

import { VAT_CONFIG } from '@/src/config/quotation.config';
import {
    formatPrice,
    getProjectTypeById,
    MULTI_CHANNEL_DISCOUNT_PERCENT,
    STANDARD_CHANNEL_CAP,
    tierSetup,
} from '@/src/data/mock/mockFeatures';
import { useQuotationStore } from '@/src/presentation/store/quotationStore';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * SummaryPanel Component
 * Shows selected features, price calculation, and quote actions
 * Includes a floating bottom bar for mobile
 */
export function SummaryPanel() {
  const {
    deliveryTier,
    getTierData,
    projectType,
    selectedFeatures,
    selectedPlatforms,
    discountPercent,
    discountAmount,
    vatOption,
    getSubtotal,
    getPlatformSubtotal,
    getDiscount,
    getChannelDiscount,
    getTotal,
    getMonthlyTotal,
    getSelectedFeaturesData,
    getSelectedPlatformsData,
    setDiscountPercent,
    setDiscountAmount,
    setVatOption,
    reset,
  } = useQuotationStore();

  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const selectedFeaturesData = getSelectedFeaturesData();
  const selectedPlatformsData = getSelectedPlatformsData();
  const projectTypeData = projectType ? getProjectTypeById(projectType) : null;
  const subtotal = hasMounted ? getSubtotal() : 0;
  const discount = hasMounted ? getDiscount() : 0;
  const channelDiscount = hasMounted ? getChannelDiscount() : 0;
  const total = hasMounted ? getTotal() : 0;
  const monthlyTotal = hasMounted ? getMonthlyTotal() : 0;
  const tierData = hasMounted ? getTierData() : null;
  // รายการย่อยต้องคูณ tier เหมือนยอดรวม ไม่งั้นตัวเลขไม่ตรงกัน
  const setupOf = (amount: number) => tierSetup(amount, deliveryTier);

  const visibleFeatures = showAllFeatures
    ? selectedFeaturesData
    : selectedFeaturesData.slice(0, 5);
  const hiddenCount = selectedFeaturesData.length - 5;

  const hasItems = hasMounted && (projectTypeData || selectedPlatformsData.length > 0 || selectedFeaturesData.length > 0);

  return (
    <>
      {/* Desktop Summary Panel */}
      <aside className="builder-summary">
        <h3 className="builder-summary-title">
          📋 สรุปใบเสนอราคา
        </h3>

        {/* รูปแบบการจ้าง — กระทบราคาทั้งใบ จึงโชว์บนสุด */}
        {tierData && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              marginBottom: '0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--color-surface-alt, rgba(127,127,127,0.08))',
              fontSize: '0.8125rem',
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {tierData.icon} {tierData.name}
            </span>
            <span style={{ display: 'block', color: 'var(--color-muted)', fontSize: '0.75rem' }}>
              {tierData.setupMultiplier === 1
                ? 'เรตฐาน (ถูกที่สุด)'
                : `ราคาปรับ ×${tierData.setupMultiplier} จากเรตฐาน`}
            </span>
          </div>
        )}

        {/* Selected Items */}
        <div className="builder-summary-items">
          {projectTypeData && (
            <div className="builder-summary-item">
              <span className="builder-summary-item-name">
                {projectTypeData.icon} {projectTypeData.name} (Base)
              </span>
              <span className="builder-summary-item-price">
                {formatPrice(setupOf(projectTypeData.basePrice))}
              </span>
            </div>
          )}

          {selectedPlatformsData.map((platform) => (
            <div key={platform.id} className="builder-summary-item">
              <span className="builder-summary-item-name">
                {platform.icon} {platform.name}
              </span>
              <span className="builder-summary-item-price">
                {platform.basePrice === 0 ? '-' : `+${formatPrice(setupOf(platform.basePrice))}`}
              </span>
            </div>
          ))}

          {visibleFeatures.map((feature) => (
            <div key={feature.id} className="builder-summary-item">
              <span className="builder-summary-item-name">
                {feature.name}
              </span>
              <span className="builder-summary-item-price">
                {feature.price === 0 ? '-' : formatPrice(setupOf(feature.price))}
              </span>
            </div>
          ))}

          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAllFeatures(!showAllFeatures)}
              className="builder-summary-toggle"
            >
              {showAllFeatures ? '▲ แสดงน้อยลง' : `▼ แสดงเพิ่มอีก ${hiddenCount} รายการ`}
            </button>
          )}

          {!hasItems && (
            <p className="builder-summary-empty">
              กรุณาเลือกประเภทธุรกิจ, Platform และฟีเจอร์
            </p>
          )}
        </div>

        <div className="builder-summary-divider" />

        {/* Price Calculation */}
        <div>
          <div className="builder-summary-row">
            <span>ค่าติดตั้ง (ครั้งเดียว)</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          {channelDiscount > 0 && (
            <div className="builder-summary-row discount">
              <span>
                ส่วนลดชุดช่องทาง
                <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.8 }}>
                  ช่องทางที่ 2 เป็นต้นไป -{MULTI_CHANNEL_DISCOUNT_PERCENT}% · รวมไม่เกิน{' '}
                  {formatPrice(STANDARD_CHANNEL_CAP)}
                </span>
              </span>
              <span>-{formatPrice(channelDiscount)}</span>
            </div>
          )}

          {/* Discount Input */}
          <div className="builder-summary-discount-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label>ส่วนลด</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={discountPercent || ''}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                style={{ width: '4rem', textAlign: 'right' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>%</span>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center', marginBottom: '0.5rem' }}>หรือ</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                min="0"
                placeholder="จำนวนเงิน"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                style={{ flex: 1, textAlign: 'right' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>฿</span>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
              💡 ระบุ % หรือ จำนวนเงินอย่างใดอย่างหนึ่ง
            </p>
          </div>

          {discount > 0 && (
            <div className="builder-summary-row discount">
              <span>ส่วนลด</span>
              <span>-{formatPrice(discount)}</span>
            </div>
          )}

          <div className="builder-summary-divider" />

          <div className="builder-summary-row total">
            <span>ราคาสุทธิ</span>
            <span style={{ color: 'var(--color-primary)' }}>
              {formatPrice(total)}
            </span>
          </div>

          {/* VAT Option */}
          <div style={{ padding: '0.5rem 0' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-foreground)', marginBottom: '0.25rem' }}>VAT</label>
            <select
              value={hasMounted ? vatOption : 'include'}
              onChange={(e) => setVatOption(e.target.value as 'include' | 'exclude' | 'exempt')}
              style={{ width: '100%' }}
            >
              <option value="include">รวม VAT 7%</option>
              <option value="exclude">ไม่รวม VAT (คิดเพิ่มภายหลัง)</option>
              <option value="exempt">ไม่คิด VAT (ยกเว้น)</option>
            </select>
          </div>

          {hasMounted && vatOption === 'include' && (
            <>
              <div className="builder-summary-row" style={{ fontSize: '0.8125rem' }}>
                <span>VAT {VAT_CONFIG.ratePercent}%</span>
                <span>{formatPrice(Math.round(total * VAT_CONFIG.rate))}</span>
              </div>
              <div className="builder-summary-row total" style={{ fontSize: '1.125rem' }}>
                <span>รวมทั้งสิ้น</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                  {formatPrice(Math.round(total * VAT_CONFIG.multiplier))}
                </span>
              </div>
            </>
          )}

          {hasMounted && vatOption === 'exclude' && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center' }}>
              * ราคายังไม่รวม VAT {VAT_CONFIG.ratePercent}%
            </p>
          )}

          {hasMounted && vatOption === 'exempt' && (
            <p style={{ fontSize: '0.75rem', color: '#16a34a', textAlign: 'center' }}>
              ✓ ไม่คิด VAT (ยกเว้น)
            </p>
          )}

          {/* ค่าบริการรายเดือน — คิดแยกจากค่าติดตั้ง */}
          {monthlyTotal > 0 && (
            <>
              <div className="builder-summary-divider" />
              <div className="builder-summary-row total" style={{ fontSize: '1rem' }}>
                <span>ค่าบริการรายเดือน</span>
                <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
                  {formatPrice(monthlyTotal)}/เดือน
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center' }}>
                * เริ่มเก็บเดือนถัดจากวันส่งมอบ · ยังไม่รวม VAT
              </p>
            </>
          )}
        </div>

        <div className="builder-summary-divider" />

        {/* Actions */}
        <div className="builder-btn-group">
          <Link href="/quote" className="builder-btn builder-btn-primary">
            📄 ดูใบเสนอราคา
          </Link>

          <Link href="/invoice" className="builder-btn builder-btn-secondary">
            📝 ออกใบแจ้งหนี้
          </Link>

          <button
            onClick={reset}
            className="builder-btn builder-btn-ghost"
          >
            🗑️ เริ่มใหม่
          </button>
        </div>

        {/* Summary Count */}
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          {selectedPlatforms.length > 0 && (
            <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-accent)' }}>
              {selectedPlatforms.length} Platform
            </span>
          )}
          <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
            เลือกแล้ว {selectedFeatures.length} ฟีเจอร์
          </span>
        </div>
      </aside>

      {/* Mobile Floating Bottom Bar */}
      <div className="mobile-summary-bar">
        {/* Expanded View */}
        {mobileExpanded && (
          <div className="mobile-summary-expanded">
            <div className="mobile-summary-header">
              <h3>📋 สรุปใบเสนอราคา</h3>
              <button onClick={() => setMobileExpanded(false)}>✕</button>
            </div>

            <div className="mobile-summary-items">
              {tierData && (
                <div className="mobile-summary-item" style={{ fontWeight: 600 }}>
                  <span>{tierData.icon} {tierData.name}</span>
                  <span>{tierData.setupMultiplier === 1 ? 'เรตฐาน' : `×${tierData.setupMultiplier}`}</span>
                </div>
              )}
              {projectTypeData && (
                <div className="mobile-summary-item">
                  <span>{projectTypeData.icon} {projectTypeData.name}</span>
                  <span>{formatPrice(setupOf(projectTypeData.basePrice))}</span>
                </div>
              )}
              {selectedPlatformsData.map((platform) => (
                <div key={platform.id} className="mobile-summary-item">
                  <span>{platform.icon} {platform.name}</span>
                  <span>{platform.basePrice === 0 ? '-' : `+${formatPrice(setupOf(platform.basePrice))}`}</span>
                </div>
              ))}
              {selectedFeaturesData.slice(0, 5).map((feature) => (
                <div key={feature.id} className="mobile-summary-item">
                  <span>{feature.name}</span>
                  <span>{feature.price === 0 ? '-' : formatPrice(setupOf(feature.price))}</span>
                </div>
              ))}
              {selectedFeaturesData.length > 5 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center' }}>
                  +{selectedFeaturesData.length - 5} รายการ
                </p>
              )}
            </div>

            <div className="mobile-summary-total">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span>ค่าติดตั้ง (ครั้งเดียว)</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {channelDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#16a34a' }}>
                  <span>ส่วนลดหลายช่องทาง</span>
                  <span>-{formatPrice(channelDiscount)}</span>
                </div>
              )}
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#16a34a' }}>
                  <span>ส่วนลด</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.125rem', marginTop: '0.25rem' }}>
                <span>รวมค่าติดตั้ง</span>
                <span style={{ color: 'var(--color-primary)' }}>{formatPrice(total)}</span>
              </div>
              {monthlyTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9375rem' }}>
                  <span>รายเดือน</span>
                  <span style={{ color: 'var(--color-accent)' }}>{formatPrice(monthlyTotal)}/ด.</span>
                </div>
              )}
            </div>

            <div className="mobile-summary-actions">
              <Link href="/quote" className="builder-btn builder-btn-primary" style={{ flex: 1 }}>
                📄 ใบเสนอราคา
              </Link>
              <Link href="/invoice" className="builder-btn builder-btn-secondary" style={{ flex: 1 }}>
                📝 ใบแจ้งหนี้
              </Link>
              <button
                onClick={() => { reset(); setMobileExpanded(false); }}
                className="builder-btn builder-btn-ghost"
              >
                🗑️
              </button>
            </div>
          </div>
        )}

        {/* Collapsed Bar */}
        <div
          className="mobile-summary-collapsed"
          onClick={() => hasItems && setMobileExpanded(!mobileExpanded)}
        >
          <div className="mobile-summary-info">
            <span className="mobile-summary-count">
              {selectedPlatforms.length > 0 && `${selectedPlatforms.length} Platform, `}{selectedFeatures.length} ฟีเจอร์
            </span>
            <span className="mobile-summary-price">
              {formatPrice(total)}
            </span>
          </div>
          <Link
            href="/quote"
            className="mobile-summary-btn"
            onClick={(e) => e.stopPropagation()}
          >
            ดูใบเสนอราคา →
          </Link>
        </div>
      </div>
    </>
  );
}
