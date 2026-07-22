/**
 * Document Store
 * เลขที่เอกสาร + วันที่ออก ของใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ
 *
 * ทำไมต้องมี store แยก:
 * เดิมเลขที่เอกสาร generate ตอน render ด้วย `Math.random()` → refresh ทีเลขเปลี่ยนที
 * เอกสารที่ส่งลูกค้ากับที่เราเห็นจึงคนละเลข อ้างอิงข้ามใบ/ตามงานไม่ได้
 *
 * ที่แก้:
 * - เลข "ออกครั้งเดียว" ตอนเปิดใบครั้งแรก แล้ว persist ไว้ (refresh ไม่เปลี่ยน)
 * - เดินเลข running ต่อวันต่อชนิดเอกสาร (OQ-20260722-001, -002, ...) แทนสุ่ม
 *   → เลขไม่ชนกันเอง และเรียงตามลำดับที่ออกจริง
 * - อยากออกใบใหม่ให้ลูกค้ารายถัดไป → `reissue()` เดินเลขถัดไปให้
 *
 * ⚠️ ข้อจำกัดที่ยอมรับ: counter อยู่ใน localStorage ของเครื่องที่ออกใบ
 * ออกใบจากคนละเครื่อง/คนละเบราว์เซอร์ในวันเดียวกัน เลขจะชนกันได้ — ถ้าจะกันจริงต้องมี backend
 */

import { DOCUMENT_PREFIXES } from '@/src/config/quotation.config';
import dayjs from 'dayjs';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DocumentKind = keyof typeof DOCUMENT_PREFIXES;

export interface IssuedDocument {
  /** เลขที่เอกสาร เช่น `OQ-20260722-001` */
  number: string;
  /** วันที่ออกใบ (YYYY-MM-DD) — เก็บเป็นรูปแบบกลาง ค่อย format ตอนแสดงผล */
  issuedAt: string;
}

/** จำนวนหลักของเลข running ต่อวัน */
const RUNNING_DIGITS = 3;

/** คีย์ของชุดเลขต่อวัน เช่น `OQ-20260722` */
function seriesKey(kind: DocumentKind, dateKey: string): string {
  return `${DOCUMENT_PREFIXES[kind]}-${dateKey}`;
}

interface DocumentState {
  /** persist hydrate เสร็จหรือยัง — กันออกเลขซ้ำก่อนอ่านค่าเดิมจาก localStorage */
  hydrated: boolean;
  /** เลข running ล่าสุดต่อชุด (คีย์ = seriesKey) */
  counters: Record<string, number>;
  /** เอกสารที่ออกเลขแล้ว (ยังไม่ออก = ไม่มีคีย์) */
  issued: Partial<Record<DocumentKind, IssuedDocument>>;

  /** ออกเลขให้ถ้ายังไม่เคยออก — เรียกซ้ำได้ ไม่เดินเลขเพิ่ม */
  ensureIssued: (kind: DocumentKind) => void;
  /** บังคับเดินเลขใหม่ (ขึ้นใบถัดไป) */
  reissue: (kind: DocumentKind) => void;
  /** ล้างเลขของเอกสารชนิดนั้น — ใบถัดไปจะออกเลขใหม่ */
  clear: (kind: DocumentKind) => void;
  /** ล้างเลขทุกชนิด (ใช้ตอนเริ่มทำใบให้ลูกค้ารายใหม่) */
  clearAll: () => void;
  /** persist middleware เรียกให้ตอน hydrate เสร็จ */
  setHydrated: () => void;
}

/** เดินเลขถัดไปของชนิดเอกสารนั้น จาก counters ปัจจุบัน */
function nextIssued(
  counters: Record<string, number>,
  kind: DocumentKind
): { counters: Record<string, number>; document: IssuedDocument } {
  const now = dayjs();
  const key = seriesKey(kind, now.format('YYYYMMDD'));
  const running = (counters[key] ?? 0) + 1;

  return {
    counters: { ...counters, [key]: running },
    document: {
      number: `${key}-${String(running).padStart(RUNNING_DIGITS, '0')}`,
      issuedAt: now.format('YYYY-MM-DD'),
    },
  };
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      counters: {},
      issued: {},

      ensureIssued: (kind) => {
        if (get().issued[kind]) return;
        const { counters, document } = nextIssued(get().counters, kind);
        set((state) => ({ counters, issued: { ...state.issued, [kind]: document } }));
      },

      reissue: (kind) => {
        const { counters, document } = nextIssued(get().counters, kind);
        set((state) => ({ counters, issued: { ...state.issued, [kind]: document } }));
      },

      clear: (kind) => {
        set((state) => {
          const issued = { ...state.issued };
          delete issued[kind];
          return { issued };
        });
      },

      clearAll: () => set({ issued: {} }),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'omnichat-document-numbers',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ counters: state.counters, issued: state.issued }),
      // hydrated ไม่ถูก persist (ไม่อยู่ใน partialize) — ตั้งค่าตอน rehydrate เสร็จเท่านั้น
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
