import { z } from 'zod';
import { idSchema } from '../ids';

/** ชนิดช่องทาง — Phase 2: web · Phase 4: +line · messenger/instagram/... เพิ่มภายหลัง (แค่ต่อ enum) */
export const channelTypeSchema = z.enum(['web', 'line']);
export type ChannelType = z.infer<typeof channelTypeSchema>;

/** Channel = instance ช่องทางที่ตั้งค่าไว้ใน workspace หนึ่ง (เช่น web widget ของเว็บ A) */
export const channelSchema = z.object({
  id: idSchema('chn'),
  workspaceId: idSchema('ws'),
  type: channelTypeSchema,
  displayName: z.string().min(1),
  createdAt: z.date(),
});

export type Channel = z.infer<typeof channelSchema>;
