import { ok } from '@omni/domain';
import type { ChannelType, Message, OutboundGateway } from '@omni/domain';

/**
 * DispatchOutboundGateway — เลือก OutboundGateway ตาม **ชนิดช่องทาง** ของ conversation
 *
 * ตั้งแต่ Phase 4 มีหลายช่องทาง (web/line) เข้า inbox เดียว → ตอน agent reply ต้องส่งออก
 * ช่องทางที่ถูกต้อง (web = push WS ของ widget · line = push LINE API) · service ไม่รู้จักช่องทาง
 * (เรียก outbound.send เดียว) — dispatch ที่ composition root เลือก gateway จาก channel type ให้
 *
 * ช่องทางที่ resolve ไม่ได้/ไม่รู้จัก → delivered:false (message persist แล้ว ไม่หาย · ไม่ throw)
 */
export interface DispatchOutboundDeps {
  /** หา channel type ของ message (จาก channelId) — null ถ้า resolve ไม่ได้ */
  resolveChannelType: (message: Message) => Promise<ChannelType | null>;
  /** gateway ต่อชนิดช่องทาง (exhaustive ตาม ChannelType) */
  byType: Record<ChannelType, OutboundGateway>;
}

export function createDispatchOutboundGateway(deps: DispatchOutboundDeps): OutboundGateway {
  const { resolveChannelType, byType } = deps;
  return {
    send: async (message) => {
      const type = await resolveChannelType(message);
      const gateway = type ? byType[type] : undefined;
      if (!gateway) return ok({ externalId: null, delivered: false });
      return gateway.send(message);
    },
  };
}
