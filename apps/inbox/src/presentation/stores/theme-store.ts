// Zustand + persist — เก็บ template (ธีม) + dark ใน localStorage key "theme-storage"
// (ต้องตรงกับ ThemeScript ที่อ่านตอน boot เพื่อกัน FOUC)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeTemplate = 'violet' | 'teal';

export const THEME_TEMPLATES: ThemeTemplate[] = ['violet', 'teal'];
export const DEFAULT_TEMPLATE: ThemeTemplate = 'violet';

interface ThemeState {
  template: ThemeTemplate;
  dark: boolean;
  setTemplate: (template: ThemeTemplate) => void;
  toggleDark: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      template: DEFAULT_TEMPLATE,
      dark: false,
      setTemplate: (template) => set({ template }),
      toggleDark: () => set((s) => ({ dark: !s.dark })),
    }),
    { name: 'theme-storage', version: 1 },
  ),
);
