import { useEffect, useRef } from 'react';

/**
 * ref ที่ชี้ค่าล่าสุดเสมอ (อัปเดตใน effect — ไม่เขียน ref ตอน render)
 * ใช้อ่านค่า/handler ล่าสุดใน callback ที่ไม่อยาก re-subscribe (เช่น ws.onmessage)
 * โดยไม่ผิด react-hooks/refs
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
