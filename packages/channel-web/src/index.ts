// @omni/channel-web — adapter ฝั่ง server ของ web chat widget
// รับ inbound จาก widget → map เข้า unified message schema · ส่ง outbound ผ่าน WS registry
// พึ่งได้แค่ @omni/domain (port/interface กลาง) — ไม่ผูกกับ framework ของ apps/api
// (WebConnectionRegistry impl อยู่ฝั่ง api, WebRouteResolver impl อยู่ @omni/db — inject ที่ composition root)

/** ชนิดช่องทางของ adapter นี้ (ตรงกับ channelTypeSchema ของ domain) */
export const CHANNEL_WEB_TYPE = 'web' as const;

export * from './session';
export * from './inbound';
export * from './wire';
export * from './outbound-gateway';
