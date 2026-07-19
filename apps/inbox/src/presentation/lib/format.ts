// Pure formatting helpers — ไม่มี side-effect / ไม่พึ่ง React → unit test ได้ตรงๆ

import type { MessageContent } from '../../domain/types';

/** เวลา HH:mm (th-TH) จาก ISO string · คืน '' ถ้า parse ไม่ได้ */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

/** ดึง text จาก content union · ชนิดที่ยังไม่รองรับ = placeholder (ไม่ throw) */
export function contentText(content: MessageContent): string {
  return content.type === 'text' ? content.text : '[ข้อความชนิดนี้ยังไม่รองรับ]';
}
