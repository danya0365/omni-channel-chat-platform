import { z } from 'zod';
import { idSchema } from '../ids';

/** Workspace = tenant root · ทุก entity ผูก workspaceId ตัวนี้ (multi-tenant ตั้งแต่แรก) */
export const workspaceSchema = z.object({
  id: idSchema('ws'),
  name: z.string().min(1),
  createdAt: z.date(),
});

export type Workspace = z.infer<typeof workspaceSchema>;
