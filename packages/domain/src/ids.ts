import { z } from 'zod';

/**
 * ID = `<prefix>_<uuid>` (text) — prefix บอกชนิด entity อ่าน/debug ง่าย
 * uuid จริงใช้ uuidv7 (time-sortable) แต่ "การสร้าง" ต้องพึ่ง entropy/clock = เรื่อง infra
 * domain จึงถือแค่ type + makeId (pure) + port IdGenerator/Clock — impl จริง inject จาก composition root
 * (ดู ADR-0002: ID = `<prefix>_<uuidv7>`)
 */
export const ID_PREFIX = {
  workspace: 'ws',
  channel: 'chn',
  contact: 'ctc',
  identity: 'idn',
  conversation: 'conv',
  message: 'msg',
  agent: 'agt',
  botRule: 'botr',
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

/** ID ที่ brand ด้วย prefix — เช่น Id<'ws'> = `ws_...` (กัน id ข้ามชนิดปนกันตอน compile) */
export type Id<P extends IdPrefix = IdPrefix> = `${P}_${string}`;

export type WorkspaceId = Id<'ws'>;
export type ChannelId = Id<'chn'>;
export type ContactId = Id<'ctc'>;
export type ContactIdentityId = Id<'idn'>;
export type ConversationId = Id<'conv'>;
export type MessageId = Id<'msg'>;
export type AgentId = Id<'agt'>;
export type BotRuleId = Id<'botr'>;

/** ประกอบ id จาก prefix + uuid (pure) */
export const makeId = <P extends IdPrefix>(prefix: P, uuid: string): Id<P> => `${prefix}_${uuid}`;

/** zod schema ของ id สำหรับ prefix หนึ่งๆ — validate prefix + brand ให้เป็น Id<P> */
export const idSchema = <P extends IdPrefix>(prefix: P) =>
  z.custom<Id<P>>(
    (val) =>
      typeof val === 'string' && val.startsWith(`${prefix}_`) && val.length > prefix.length + 1,
  );

/**
 * IdGenerator — port สร้าง id ใหม่ · impl จริง (uuidv7) inject จาก composition root
 * แยกออกมาเพื่อให้ domain pure (ไม่พึ่ง crypto) + service test ได้แบบ deterministic
 */
export type IdGenerator = <P extends IdPrefix>(prefix: P) => Id<P>;

/** Clock — port อ่านเวลาปัจจุบัน · inject เพื่อให้ test คุมเวลาได้ */
export type Clock = () => Date;
