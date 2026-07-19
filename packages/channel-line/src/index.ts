// @omni/channel-line — adapter ฝั่ง server ของ LINE Messaging API
// inbound: verify x-line-signature (HMAC-SHA256 ของ raw body) → map LINE event → unified ingest command
// outbound: push unified message → LINE push API · credential (encrypted) resolve จาก @omni/db ผ่าน bridge ที่ composition root
// พึ่งได้แค่ @omni/domain + zod + node builtins — ไม่ผูก framework/adapter อื่น (บังคับด้วย dependency-cruiser)

/** ชนิดช่องทางของ adapter นี้ (ตรงกับ channelTypeSchema ของ domain) */
export const CHANNEL_LINE_TYPE = 'line' as const;

export * from './signature';
export * from './credentials';
export * from './inbound';
export * from './outbound-gateway';
export * from './push-client';
