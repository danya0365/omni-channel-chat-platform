// @omni/channel-web — adapter ฝั่ง server ของ web chat widget
// รับ inbound จาก widget → map เข้า unified message schema · ส่ง outbound ผ่าน WS registry
// พึ่งได้แค่ @omni/domain (port/interface กลาง) — ไม่ผูกกับ framework ของ apps/api
// Phase 2 จะเติม: session handling, inbound mapper, outbound gateway (implement OutboundGateway port)

export const CHANNEL_WEB_TYPE = 'web' as const;
