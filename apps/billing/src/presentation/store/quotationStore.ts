/**
 * Quotation Store
 * Zustand store สำหรับเก็บ state ของใบเสนอราคา OmniChat
 */

import {
    calculateChannelDiscount,
    calculateMonthlyTotal,
    calculatePlatformPrice,
    calculateTotalPrice,
    checkDependencies,
    getDependentFeatures,
    getDeliveryTierById,
    getFeatureById,
    getPlatformById,
    getProjectTypeById,
    tierMonthly,
    tierSetup,
    type DeliveryTier,
    type Feature,
    type Platform,
} from '@/src/data/mock/mockFeatures';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface QuotationState {
  // State
  /** รูปแบบการจ้าง — คูณราคาทั้งใบ (default 'solo-ai' = เรตถูกสุด ×1.0) */
  deliveryTier: string;
  projectType: string | null;
  selectedPlatforms: string[];
  selectedFeatures: string[];
  discountPercent: number;
  discountAmount: number;
  vatOption: 'include' | 'exclude' | 'exempt';
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;

  // Computed
  getSubtotal: () => number;
  getPlatformSubtotal: () => number;
  getDiscount: () => number;
  /** ส่วนลดหลายช่องทาง (auto) — แยกจากส่วนลดที่กรอกเอง เพื่อให้ลูกค้าเห็นว่าได้ลดอะไรไปบ้าง */
  getChannelDiscount: () => number;
  getTotal: () => number;
  /** ค่าบริการรายเดือน (แยกจากค่าติดตั้ง — ไม่คิดส่วนลด/VAT) */
  getMonthlyTotal: () => number;
  getSelectedFeaturesData: () => Feature[];
  getSelectedPlatformsData: () => Platform[];
  getTierData: () => DeliveryTier | null;

  // Actions
  setDeliveryTier: (id: string) => void;
  setProjectType: (id: string | null) => void;
  toggleFeature: (id: string) => void;
  selectFeatures: (ids: string[]) => void;
  clearFeatures: () => void;
  canSelectFeature: (id: string) => boolean;
  togglePlatform: (id: string) => void;
  clearPlatforms: () => void;
  setDiscountPercent: (percent: number) => void;
  setDiscountAmount: (amount: number) => void;
  setVatOption: (option: 'include' | 'exclude' | 'exempt') => void;
  setCustomerInfo: (info: { name?: string; phone?: string; email?: string }) => void;
  setNotes: (notes: string) => void;
  reset: () => void;
}

const initialState = {
  deliveryTier: 'solo-ai',
  projectType: null as string | null,
  selectedPlatforms: [] as string[],
  selectedFeatures: [] as string[],
  discountPercent: 0,
  discountAmount: 0,
  vatOption: 'include' as 'include' | 'exclude' | 'exempt',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  notes: '',
};

export const useQuotationStore = create<QuotationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ============================================
      // Computed
      // ============================================
      getSubtotal: () => {
        const { projectType, selectedFeatures, selectedPlatforms, deliveryTier } = get();
        const featurePrice = calculateTotalPrice(projectType, selectedFeatures);
        const platformPrice = calculatePlatformPrice(selectedPlatforms);
        return tierSetup(featurePrice + platformPrice, deliveryTier);
      },

      getPlatformSubtotal: () => {
        const { selectedPlatforms, deliveryTier } = get();
        return tierSetup(calculatePlatformPrice(selectedPlatforms), deliveryTier);
      },

      getDiscount: () => {
        const subtotal = get().getSubtotal();
        const { discountPercent, discountAmount } = get();
        if (discountAmount > 0) {
          return discountAmount;
        }
        return Math.round(subtotal * (discountPercent / 100));
      },

      getChannelDiscount: () => {
        const { selectedFeatures, deliveryTier } = get();
        return tierSetup(calculateChannelDiscount(selectedFeatures), deliveryTier);
      },

      getTotal: () => {
        return get().getSubtotal() - get().getChannelDiscount() - get().getDiscount();
      },

      getMonthlyTotal: () => {
        const { projectType, selectedFeatures, selectedPlatforms, deliveryTier } = get();
        const base = calculateMonthlyTotal(projectType, selectedFeatures, selectedPlatforms);
        return tierMonthly(base, deliveryTier);
      },

      getTierData: () => {
        return getDeliveryTierById(get().deliveryTier) ?? null;
      },

      getSelectedFeaturesData: () => {
        const { selectedFeatures } = get();
        return selectedFeatures
          .map((id) => getFeatureById(id))
          .filter((f): f is Feature => f !== undefined);
      },

      getSelectedPlatformsData: () => {
        const { selectedPlatforms } = get();
        return selectedPlatforms
          .map((id) => getPlatformById(id))
          .filter((p): p is Platform => p !== undefined);
      },

      // ============================================
      // Actions
      // ============================================
      setDeliveryTier: (id) => {
        if (getDeliveryTierById(id)) {
          set({ deliveryTier: id });
        }
      },

      setProjectType: (id) => {
        const projectType = id ? getProjectTypeById(id) : null;
        if (projectType || id === null) {
          set({ projectType: id });
        }
      },

      toggleFeature: (id) => {
        const { selectedFeatures } = get();
        const isSelected = selectedFeatures.includes(id);

        if (isSelected) {
          // When deselecting, recursively remove all dependent features
          const toRemove = new Set<string>([id]);
          const findDependents = (featureId: string) => {
            const dependents = getDependentFeatures(featureId);
            for (const dep of dependents) {
              if (selectedFeatures.includes(dep.id) && !toRemove.has(dep.id)) {
                toRemove.add(dep.id);
                findDependents(dep.id);
              }
            }
          };
          findDependents(id);

          set({ selectedFeatures: selectedFeatures.filter((fId) => !toRemove.has(fId)) });
        } else {
          if (get().canSelectFeature(id)) {
            set({ selectedFeatures: [...selectedFeatures, id] });
          }
        }
      },

      selectFeatures: (ids) => {
        set({ selectedFeatures: ids });
      },

      clearFeatures: () => {
        set({ selectedFeatures: [] });
      },

      canSelectFeature: (id) => {
        const { selectedFeatures } = get();
        return checkDependencies(id, selectedFeatures);
      },

      togglePlatform: (id) => {
        const { selectedPlatforms } = get();
        const isSelected = selectedPlatforms.includes(id);
        if (isSelected) {
          set({ selectedPlatforms: selectedPlatforms.filter((pId) => pId !== id) });
        } else {
          set({ selectedPlatforms: [...selectedPlatforms, id] });
        }
      },

      clearPlatforms: () => {
        set({ selectedPlatforms: [] });
      },

      setDiscountPercent: (percent) => {
        set({ discountPercent: Math.max(0, Math.min(100, percent)), discountAmount: 0 });
      },

      setDiscountAmount: (amount) => {
        set({ discountAmount: Math.max(0, amount), discountPercent: 0 });
      },

      setVatOption: (option) => {
        set({ vatOption: option });
      },

      setCustomerInfo: (info) => {
        set((state) => ({
          customerName: info.name ?? state.customerName,
          customerPhone: info.phone ?? state.customerPhone,
          customerEmail: info.email ?? state.customerEmail,
        }));
      },

      setNotes: (notes) => {
        set({ notes });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'omnichat-quotation-storage-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        deliveryTier: state.deliveryTier,
        projectType: state.projectType,
        selectedPlatforms: state.selectedPlatforms,
        selectedFeatures: state.selectedFeatures,
        discountPercent: state.discountPercent,
        discountAmount: state.discountAmount,
        vatOption: state.vatOption,
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        customerEmail: state.customerEmail,
        notes: state.notes,
      }),
    }
  )
);
