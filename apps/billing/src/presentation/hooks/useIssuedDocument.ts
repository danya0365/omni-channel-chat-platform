'use client';

import {
    useDocumentStore,
    type DocumentKind,
} from '@/src/presentation/store/documentStore';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { useCallback, useEffect } from 'react';

/**
 * useIssuedDocument Hook
 * ออก "เลขที่เอกสาร + วันที่ออก" ให้เอกสาร 1 ชนิด แล้วคงค่านั้นไว้
 *
 * ใช้แทนการ generate เลขตอน render (ของเดิมใช้ `Math.random()` ใน `useMemo`
 * → refresh ทีเลขเปลี่ยนที และผิดกฎ purity ของ React)
 *
 * เลขออกใน effect หลัง persist hydrate เสร็จ เพื่อไม่ให้เดินเลขทับของเดิมที่เก็บไว้
 */
export function useIssuedDocument(kind: DocumentKind) {
  const hydrated = useDocumentStore((state) => state.hydrated);
  const issued = useDocumentStore((state) => state.issued[kind]);
  const ensureIssued = useDocumentStore((state) => state.ensureIssued);
  const reissue = useDocumentStore((state) => state.reissue);

  useEffect(() => {
    if (hydrated) {
      ensureIssued(kind);
    }
  }, [hydrated, kind, ensureIssued]);

  /** ออกเลขใหม่ (ขึ้นใบถัดไป) — ใช้ตอนทำใบให้ลูกค้ารายใหม่ */
  const reissueNumber = useCallback(() => reissue(kind), [kind, reissue]);

  const issuedAt = issued?.issuedAt ?? null;

  return {
    /** เลขที่เอกสาร — ว่างระหว่างรอ hydrate */
    documentNumber: issued?.number ?? '',
    /** วันที่ออกใบ (YYYY-MM-DD) — ใช้เป็นฐานคำนวณวันหมดอายุ/ครบกำหนด */
    issuedAt,
    /** วันที่ออกใบแบบไทย เช่น 22 กรกฎาคม 2026 */
    documentDate: issuedAt ? dayjs(issuedAt).locale('th').format('D MMMM YYYY') : '',
    /** ออกเลขเรียบร้อยแล้วหรือยัง (ใช้กันไม่ให้สั่งพิมพ์ใบที่ยังไม่มีเลข) */
    isReady: !!issued,
    reissueNumber,
  };
}
