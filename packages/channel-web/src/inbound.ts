import type { ChannelId, IngestInboundCommand, WorkspaceId } from '@omni/domain';

/** payload ที่ widget ส่งเข้ามา (หลัง api resolve channel → workspace แล้ว) */
export interface WebInboundInput {
  workspaceId: WorkspaceId;
  channelId: ChannelId;
  /** sessionId ของ widget = externalId ของ identity บนช่องทาง web */
  sessionId: string;
  text: string;
  /** ชื่อที่ visitor กรอก (ถ้ามี) — ใช้ตอนสร้าง contact ใหม่ */
  contactName?: string | null;
}

/**
 * map payload ดิบจาก web widget → unified ingest command
 * (core ไม่รู้จัก payload ดิบของ web — adapter แปลงให้ที่นี่) · text ว่าง = ingest จะ reject เอง
 */
export function toIngestCommand(input: WebInboundInput): IngestInboundCommand {
  return {
    workspaceId: input.workspaceId,
    channelId: input.channelId,
    externalId: input.sessionId,
    content: { type: 'text', text: input.text },
    contactName: input.contactName ?? null,
  };
}
