'use client';

import type { DeliveryTier, Feature, FeatureLevel, FeaturePackage, Platform } from '@/src/data/mock/mockFeatures';
import { useBuilderPresenter } from '@/src/presentation/hooks/useBuilderPresenter';
import { SummaryPanel } from './SummaryPanel';

/**
 * BuilderView Component
 * Main view for the OmniChat quotation builder page
 * Following Clean Architecture — uses presenter hook for logic
 */
export function BuilderView() {
  const {
    PROJECT_TYPES,
    PLATFORMS,
    FEATURE_CATEGORIES,
    DELIVERY_TIERS,
    deliveryTier,
    setDeliveryTier,
    tierSetupOf,
    tierMonthlyOf,
    projectType,
    selectedFeatures,
    selectedPlatforms,
    activeCategory,
    showCustomize,
    availablePackages,
    groupedFeatures,
    filteredCategories,
    handleSelectProjectType,
    handleSelectPackage,
    handleCustomize,
    handleBackToPackages,
    setActiveCategory,
    toggleFeature,
    togglePlatform,
    canSelectFeature,
    isFeatureRecommended,
    getFeatureMissingDeps,
    getPackagePrice,
    getPackageMonthlyPrice,
    formatPrice,
  } = useBuilderPresenter();

  return (
    <div className="builder-page">
      <div className="builder-container">
        {/* Main Content */}
        <div className="builder-main">
          {/* Header */}
          <div className="builder-header">
            <h1 className="builder-title">สร้างใบเสนอราคา</h1>
            <p className="builder-subtitle">
              เลือกรูปแบบการจ้าง ประเภทธุรกิจ และฟีเจอร์ที่ต้องการ — ราคาคำนวณให้ทันที
            </p>
          </div>

          {/* Step 1: Delivery Tier Selection */}
          <DeliveryTierSection
            tiers={DELIVERY_TIERS}
            selectedTier={deliveryTier}
            onSelect={setDeliveryTier}
          />

          {/* Step 2: Project Type Selection */}
          <ProjectTypeSection
            projectTypes={PROJECT_TYPES}
            selectedType={projectType}
            onSelect={handleSelectProjectType}
            tierSetupOf={tierSetupOf}
            tierMonthlyOf={tierMonthlyOf}
            formatPrice={formatPrice}
          />

          {/* Step 3: Platform Selection */}
          {projectType && (
            <PlatformSection
              platforms={PLATFORMS}
              selectedPlatforms={selectedPlatforms}
              onToggle={togglePlatform}
              tierSetupOf={tierSetupOf}
              tierMonthlyOf={tierMonthlyOf}
              formatPrice={formatPrice}
            />
          )}

          {/* Step 4: Package Selection */}
          {projectType && !showCustomize && (
            <PackageSection
              packages={availablePackages}
              projectType={projectType}
              onSelectPackage={handleSelectPackage}
              onCustomize={handleCustomize}
              getPackagePrice={getPackagePrice}
              getPackageMonthlyPrice={getPackageMonthlyPrice}
              formatPrice={formatPrice}
            />
          )}

          {/* Step 4: Feature Customization */}
          {projectType && showCustomize && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={handleBackToPackages}
                  className="builder-btn-back"
                >
                  ← กลับไปเลือกแพ็กเกจ
                </button>
              </div>

              <CategoryFilter
                categories={FEATURE_CATEGORIES}
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
              />

              <div className="builder-features">
                {filteredCategories.map((category) => {
                  const categoryFeatures = groupedFeatures[category.id];
                  if (!categoryFeatures?.length) return null;

                  return (
                    <div key={category.id} className="builder-category-group">
                      <h3 className="builder-category-title">
                        <span>{category.icon}</span>
                        <span style={{ marginLeft: '0.5rem' }}>{category.name}</span>
                      </h3>
                      <div className="builder-features-grid">
                        {categoryFeatures.map((feature) => (
                          <FeatureCard
                            key={feature.id}
                            feature={feature}
                            isSelected={selectedFeatures.includes(feature.id)}
                            canSelect={canSelectFeature(feature.id)}
                            missingDeps={getFeatureMissingDeps(feature.id)}
                            isRecommended={isFeatureRecommended(feature)}
                            onToggle={() => toggleFeature(feature.id)}
                            tierSetupOf={tierSetupOf}
                            tierMonthlyOf={tierMonthlyOf}
                            formatPrice={formatPrice}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Summary Panel */}
        <SummaryPanel />
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface DeliveryTierSectionProps {
  tiers: DeliveryTier[];
  selectedTier: string;
  onSelect: (id: string) => void;
}

/** ป้ายบอกว่าแพงกว่าเรตฐานกี่ % — เรตฐาน (×1.0) = solo dev + AI */
function tierBadge(multiplier: number): string {
  if (multiplier <= 1) return 'ราคาฐาน';
  return `+${Math.round((multiplier - 1) * 100)}%`;
}

function DeliveryTierSection({ tiers, selectedTier, onSelect }: DeliveryTierSectionProps) {
  return (
    <div className="builder-platforms">
      <h2 className="builder-section-title">1. เลือกรูปแบบการจ้าง</h2>
      <p className="builder-section-desc">
        ทีมที่ทำงานให้คุณมีผลกับราคาโดยตรง — งบจำกัดเลือกแบบถูก งานใหญ่/องค์กรเลือกแบบมีทีมเต็ม
        (ราคาทั้งใบจะปรับตามที่เลือกทันที)
      </p>
      <div className="builder-platform-grid">
        {tiers.map((tier) => {
          const isSelected = selectedTier === tier.id;
          return (
            <button
              key={tier.id}
              onClick={() => onSelect(tier.id)}
              className={`builder-platform-card ${isSelected ? 'selected' : ''}`}
            >
              <div className="builder-platform-checkbox">{isSelected && '✓'}</div>
              <span className="builder-platform-icon">{tier.icon}</span>
              <span className="builder-platform-name">{tier.name}</span>
              <span className="builder-platform-name-en">{tier.nameEn}</span>
              <span className="builder-platform-description">{tier.description}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-muted)',
                  lineHeight: 1.5,
                  display: 'block',
                  marginTop: '0.5rem',
                  textAlign: 'left',
                }}
              >
                {tier.detail}
              </span>
              <span className="builder-platform-price">
                {tierBadge(tier.setupMultiplier)}
                {tier.monthlyMultiplier !== tier.setupMultiplier &&
                  ` · รายเดือน ${tierBadge(tier.monthlyMultiplier)}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ProjectTypeSectionProps {
  projectTypes: { id: string; name: string; icon: string; basePrice: number; monthlyPrice: number }[];
  selectedType: string | null;
  onSelect: (id: string | null) => void;
  tierSetupOf: (amount: number) => number;
  tierMonthlyOf: (amount: number) => number;
  formatPrice: (price: number) => string;
}

function ProjectTypeSection({
  projectTypes,
  selectedType,
  onSelect,
  tierSetupOf,
  tierMonthlyOf,
  formatPrice,
}: ProjectTypeSectionProps) {
  return (
    <div className="builder-project-types">
      <h2 className="builder-section-title">2. เลือกประเภทธุรกิจ</h2>
      <div className="builder-project-grid">
        {projectTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => onSelect(type.id)}
            className={`builder-project-card ${selectedType === type.id ? 'selected' : ''}`}
          >
            <span className="builder-project-icon">{type.icon}</span>
            <span className="builder-project-name">{type.name}</span>
            <span className="builder-project-price">
              เริ่มต้น {formatPrice(tierSetupOf(type.basePrice))}
              {type.monthlyPrice > 0 && (
                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400 }}>
                  + {formatPrice(tierMonthlyOf(type.monthlyPrice))}/เดือน
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface PlatformSectionProps {
  platforms: Platform[];
  selectedPlatforms: string[];
  onToggle: (id: string) => void;
  tierSetupOf: (amount: number) => number;
  tierMonthlyOf: (amount: number) => number;
  formatPrice: (price: number) => string;
}

function PlatformSection({
  platforms,
  selectedPlatforms,
  onToggle,
  tierSetupOf,
  tierMonthlyOf,
  formatPrice,
}: PlatformSectionProps) {
  return (
    <div className="builder-platforms">
      <h2 className="builder-section-title">3. เลือก Platform</h2>
      <p className="builder-section-desc">เลือกแพลตฟอร์มที่ต้องการ (เลือกได้หลายรายการ)</p>
      <div className="builder-platform-grid">
        {platforms.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id);
          return (
            <button
              key={platform.id}
              onClick={() => onToggle(platform.id)}
              className={`builder-platform-card ${isSelected ? 'selected' : ''}`}
            >
              <div className="builder-platform-checkbox">{isSelected && '✓'}</div>
              <span className="builder-platform-icon">{platform.icon}</span>
              <span className="builder-platform-name">{platform.name}</span>
              <span className="builder-platform-name-en">{platform.nameEn}</span>
              <span className="builder-platform-description">{platform.description}</span>
              <span className="builder-platform-price">
                {platform.basePrice === 0
                  ? 'รวมในราคา'
                  : `+${formatPrice(tierSetupOf(platform.basePrice))}`}
                {platform.monthlyPrice > 0 &&
                  ` + ${formatPrice(tierMonthlyOf(platform.monthlyPrice))}/เดือน`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PackageSectionProps {
  packages: FeaturePackage[];
  projectType: string;
  onSelectPackage: (pkg: FeaturePackage) => void;
  onCustomize: () => void;
  getPackagePrice: (pkg: FeaturePackage) => number;
  getPackageMonthlyPrice: (pkg: FeaturePackage) => number;
  formatPrice: (price: number) => string;
}

function PackageSection({
  packages,
  onSelectPackage,
  onCustomize,
  getPackagePrice,
  getPackageMonthlyPrice,
  formatPrice,
}: PackageSectionProps) {
  return (
    <div className="builder-packages">
      <h2 className="builder-section-title">4. เลือกแพ็กเกจ</h2>
      <div className="builder-package-grid">
        {packages.map((pkg) => {
          const price = getPackagePrice(pkg);
          const monthly = getPackageMonthlyPrice(pkg);
          return (
            <button
              key={pkg.id}
              onClick={() => onSelectPackage(pkg)}
              className="builder-package-card"
            >
              {pkg.discountPercent > 0 && (
                <span className="builder-package-discount">
                  ลด {pkg.discountPercent}%
                </span>
              )}
              <span className="builder-package-icon">{pkg.icon}</span>
              <h3 className="builder-package-name">{pkg.name}</h3>
              <p className="builder-package-name-en">{pkg.nameEn}</p>
              <p className="builder-package-description">{pkg.description}</p>
              <div className="builder-package-features">
                {pkg.features.length} ฟีเจอร์
              </div>
              <div className="builder-package-price">{formatPrice(price)}</div>
              {monthly > 0 && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>
                  + {formatPrice(monthly)}/เดือน
                </div>
              )}
            </button>
          );
        })}

        {/* Custom Option */}
        <button
          onClick={onCustomize}
          className="builder-package-card builder-package-custom"
        >
          <span className="builder-package-icon">🛠️</span>
          <h3 className="builder-package-name">กำหนดเอง</h3>
          <p className="builder-package-name-en">Custom</p>
          <p className="builder-package-description">
            เลือกฟีเจอร์ที่ต้องการด้วยตัวเอง
          </p>
          <div className="builder-package-features" style={{ color: 'var(--color-primary)' }}>
            เลือกฟีเจอร์ →
          </div>
        </button>
      </div>
    </div>
  );
}

interface CategoryFilterProps {
  categories: { id: string; name: string; icon: string }[];
  activeCategory: string;
  onSelect: (id: string) => void;
}

function CategoryFilter({ categories, activeCategory, onSelect }: CategoryFilterProps) {
  return (
    <div className="builder-category-filter">
      <button
        onClick={() => onSelect('all')}
        className={`builder-category-btn ${activeCategory === 'all' ? 'active' : ''}`}
      >
        ทั้งหมด
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`builder-category-btn ${activeCategory === cat.id ? 'active' : ''}`}
        >
          <span>{cat.icon}</span>
          <span style={{ marginLeft: '0.25rem' }}>{cat.name}</span>
        </button>
      ))}
    </div>
  );
}

interface FeatureCardProps {
  feature: Feature;
  isSelected: boolean;
  canSelect: boolean;
  missingDeps: Feature[];
  isRecommended: boolean;
  onToggle: () => void;
  tierSetupOf: (amount: number) => number;
  tierMonthlyOf: (amount: number) => number;
  formatPrice: (price: number) => string;
}

function FeatureCard({
  feature,
  isSelected,
  canSelect,
  missingDeps,
  isRecommended,
  onToggle,
  tierSetupOf,
  tierMonthlyOf,
  formatPrice,
}: FeatureCardProps) {
  const isDisabled = !canSelect && !isSelected;

  return (
    <div
      onClick={() => !isDisabled && onToggle()}
      className={`builder-feature-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
    >
      {feature.isPopular && (
        <span className="builder-feature-popular">🔥 ยอดนิยม</span>
      )}

      {isRecommended && !feature.isPopular && (
        <span className="builder-feature-recommended">✨ แนะนำ</span>
      )}

      <div className="builder-feature-header">
        <div className="builder-feature-checkbox">{isSelected && '✓'}</div>
      </div>

      <h4 className="builder-feature-name">{feature.name}</h4>
      <p className="builder-feature-description">{feature.description}</p>

      <div className="builder-feature-meta">
        <LevelBadge level={feature.level} />
        <span className="builder-feature-price">
          {feature.price === 0 ? 'รวมในแพ็คเกจ' : formatPrice(tierSetupOf(feature.price))}
          {feature.monthlyPrice > 0 && (
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-muted)' }}>
              + {formatPrice(tierMonthlyOf(feature.monthlyPrice))}/เดือน
            </span>
          )}
        </span>
      </div>

      {missingDeps.length > 0 && !isSelected && (
        <div className="builder-feature-deps">
          ⚠️ ต้องเลือก: {missingDeps.map((d) => d.name).join(', ')}
        </div>
      )}
    </div>
  );
}

function LevelBadge({ level }: { level: FeatureLevel }) {
  const labels: Record<FeatureLevel, string> = {
    basic: 'Basic',
    standard: 'Standard',
    premium: 'Premium',
  };

  return (
    <span className={`builder-feature-level level-${level}`}>{labels[level]}</span>
  );
}
