import { randomBytes } from 'node:crypto';
import { makeId } from '@omni/domain';
import type { Clock, IdGenerator } from '@omni/domain';

/**
 * uuidv7 — time-sortable UUID (48-bit ms timestamp + version/variant + random)
 * ทำเองแทนพึ่ง lib เพื่อคุม dependency · time-prefix ทำให้ id เรียงตามเวลา (ดีต่อ index/pagination)
 */
export function uuidv7(): string {
  const timeHex = Date.now().toString(16).padStart(12, '0').slice(-12); // 48 bit = 12 hex
  const rnd = Array.from(randomBytes(10), (b) => b.toString(16).padStart(2, '0')).join(''); // 20 hex
  const randA = rnd.slice(0, 3); // 12 bit
  const variant = ((parseInt(rnd.slice(3, 4), 16) & 0x3) | 0x8).toString(16); // 10xx
  const randB = rnd.slice(4, 19); // 60 bit ที่เหลือ
  const hex = `${timeHex}7${randA}${variant}${randB}`; // 12 + 1(version) + 3 + 1(variant) + 15 = 32
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** IdGenerator จริง — `<prefix>_<uuidv7>` · inject เข้า service ที่ composition root */
export const createIdGenerator =
  (uuid: () => string = uuidv7): IdGenerator =>
  (prefix) =>
    makeId(prefix, uuid());

/** Clock จริง — เวลาปัจจุบันของระบบ */
export const systemClock: Clock = () => new Date();
