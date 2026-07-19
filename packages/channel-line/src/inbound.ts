import { z } from 'zod';
import type { ChannelId, IngestInboundCommand, WorkspaceId } from '@omni/domain';

/** context ที่ api resolve มาแล้ว (channelId → workspace) ก่อน map event เข้า core */
export interface LineInboundContext {
  workspaceId: WorkspaceId;
  channelId: ChannelId;
}

/** webhook body ของ LINE — สนใจแค่ events[] · parse หลวมที่ระดับบน แล้ว narrow ต่อ event */
const lineWebhookBodySchema = z.object({
  destination: z.string().optional(),
  events: z.array(z.unknown()).default([]),
});

/**
 * text message event จาก user — ช่องทางเดียวที่เรา ingest ตอนนี้ (MVP text only)
 * (follow/unfollow/join/postback/sticker/image ฯลฯ ยังไม่รองรับ — ข้ามไปเฉยๆ ไม่ error)
 */
const lineTextMessageEventSchema = z.object({
  type: z.literal('message'),
  message: z.object({
    type: z.literal('text'),
    id: z.string().min(1),
    text: z.string(),
  }),
  source: z.object({
    type: z.string(),
    /** LINE userId — ใช้เป็น externalId ของ identity + ปลายทาง push (ต้องมี ไม่งั้น reply ไม่ได้) */
    userId: z.string().min(1),
  }),
  timestamp: z.number().optional(),
  replyToken: z.string().optional(),
});

/**
 * map LINE webhook body → รายการ IngestInboundCommand (เฉพาะ text message จาก user ที่มี userId)
 *
 * - body ผิดรูป → คืน [] (ไม่ throw — webhook ต้องตอบ 200 เสมอ ไม่งั้น LINE retry รัว)
 * - event ที่ไม่ใช่ text message / ไม่มี userId → ข้าม (ไม่ ingest แต่ไม่ error)
 * - text ว่าง → ข้าม (ป้องกัน ingest reject content ว่าง)
 * - contactName = null เสมอ: LINE webhook ไม่แนบ display name (ต้องเรียก profile API — นอก scope MVP)
 */
export function toIngestCommands(body: unknown, ctx: LineInboundContext): IngestInboundCommand[] {
  const parsed = lineWebhookBodySchema.safeParse(body);
  if (!parsed.success) return [];

  const commands: IngestInboundCommand[] = [];
  for (const rawEvent of parsed.data.events) {
    const event = lineTextMessageEventSchema.safeParse(rawEvent);
    if (!event.success) continue;
    const { message, source } = event.data;
    if (!message.text) continue;
    commands.push({
      workspaceId: ctx.workspaceId,
      channelId: ctx.channelId,
      externalId: source.userId,
      content: { type: 'text', text: message.text },
      contactName: null,
      externalMessageId: message.id,
    });
  }
  return commands;
}
