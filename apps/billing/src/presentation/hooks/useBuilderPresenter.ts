'use client';

import {
    calculatePackageMonthlyPrice,
    calculatePackagePrice,
    DELIVERY_TIERS,
    FEATURE_CATEGORIES,
    FEATURES,
    formatPrice,
    getFeaturesByCategory,
    getMissingDependencies,
    getPackagesForProjectType,
    PLATFORMS,
    PROJECT_TYPES,
    tierMonthly,
    tierSetup,
    type Feature,
    type FeaturePackage,
} from '@/src/data/mock/mockFeatures';
import { useQuotationStore } from '@/src/presentation/store/quotationStore';
import { useCallback, useMemo, useState } from 'react';

/**
 * useBuilderPresenter Hook
 * Handles all business logic for BuilderView
 * Following Clean Architecture — separates logic from UI
 */
export function useBuilderPresenter() {
  // Store state
  const {
    deliveryTier,
    setDeliveryTier,
    projectType,
    selectedFeatures,
    selectedPlatforms,
    setProjectType,
    toggleFeature,
    togglePlatform,
    canSelectFeature,
    selectFeatures,
    setDiscountPercent,
  } = useQuotationStore();

  // Local state
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showCustomize, setShowCustomize] = useState(false);

  // Get packages for selected project type
  const availablePackages = useMemo(() => {
    if (!projectType) return [];
    return getPackagesForProjectType(projectType);
  }, [projectType]);

  // Filter features by category
  const filteredFeatures = useMemo(() => {
    if (activeCategory === 'all') {
      return FEATURES;
    }
    return getFeaturesByCategory(activeCategory);
  }, [activeCategory]);

  // Group features by category for display
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, Feature[]> = {};
    filteredFeatures.forEach((feature) => {
      if (!groups[feature.categoryId]) {
        groups[feature.categoryId] = [];
      }
      groups[feature.categoryId].push(feature);
    });
    return groups;
  }, [filteredFeatures]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return FEATURE_CATEGORIES.filter(
      (cat) => activeCategory === 'all' || cat.id === activeCategory
    );
  }, [activeCategory]);

  // Handle project type selection
  const handleSelectProjectType = useCallback(
    (id: string | null) => {
      if (id === projectType) {
        setProjectType(null);
        selectFeatures([]);
      } else {
        setProjectType(id);
        if (id) {
          // Auto-select basic mandatory features (price === 0)
          const baseFeatureIds = FEATURES.filter(
            (f) => f.price === 0 && f.recommendedFor.includes(id)
          ).map((f) => f.id);
          selectFeatures(baseFeatureIds);
        } else {
          selectFeatures([]);
        }
        setShowCustomize(false);
      }
    },
    [projectType, setProjectType, selectFeatures]
  );

  // Handle package selection
  const handleSelectPackage = useCallback(
    (pkg: FeaturePackage) => {
      selectFeatures(pkg.features);
      setDiscountPercent(pkg.discountPercent);
      setShowCustomize(true);
    },
    [selectFeatures, setDiscountPercent]
  );

  // Handle customize click
  const handleCustomize = useCallback(() => {
    setShowCustomize(true);
  }, []);

  // Go back to package selection
  const handleBackToPackages = useCallback(() => {
    setShowCustomize(false);
  }, []);

  // Check if feature is recommended
  const isFeatureRecommended = useCallback(
    (feature: Feature) => {
      return projectType ? feature.recommendedFor.includes(projectType) : false;
    },
    [projectType]
  );

  // Get missing dependencies for a feature
  const getFeatureMissingDeps = useCallback(
    (featureId: string) => {
      return getMissingDependencies(featureId, selectedFeatures);
    },
    [selectedFeatures]
  );

  // Calculate package price
  // ── ตัวคูณตามรูปแบบการจ้าง — ทุกราคาที่แสดงต้องผ่าน 2 ตัวนี้ ไม่งั้นไม่ตรงกับยอดรวม ──
  const tierSetupOf = useCallback(
    (amount: number) => tierSetup(amount, deliveryTier),
    [deliveryTier]
  );

  const tierMonthlyOf = useCallback(
    (amount: number) => tierMonthly(amount, deliveryTier),
    [deliveryTier]
  );

  const getPackagePrice = useCallback(
    (pkg: FeaturePackage) => {
      if (!projectType) return 0;
      return tierSetup(calculatePackagePrice(pkg, projectType), deliveryTier);
    },
    [projectType, deliveryTier]
  );

  // ค่าบริการรายเดือนของแพ็กเกจ (แสดงคู่กับค่าติดตั้งบนการ์ด)
  const getPackageMonthlyPrice = useCallback(
    (pkg: FeaturePackage) => {
      if (!projectType) return 0;
      return tierMonthly(calculatePackageMonthlyPrice(pkg, projectType), deliveryTier);
    },
    [projectType, deliveryTier]
  );

  return {
    // Constants
    PROJECT_TYPES,
    PLATFORMS,
    FEATURE_CATEGORIES,
    DELIVERY_TIERS,

    // State
    deliveryTier,
    setDeliveryTier,
    tierSetupOf,
    tierMonthlyOf,
    projectType,
    selectedFeatures,
    selectedPlatforms,
    activeCategory,
    showCustomize,

    // Computed
    availablePackages,
    filteredFeatures,
    groupedFeatures,
    filteredCategories,

    // Actions
    handleSelectProjectType,
    handleSelectPackage,
    handleCustomize,
    handleBackToPackages,
    setActiveCategory,
    toggleFeature,
    togglePlatform,
    canSelectFeature,

    // Helpers
    isFeatureRecommended,
    getFeatureMissingDeps,
    getPackagePrice,
    getPackageMonthlyPrice,
    formatPrice,
  };
}
