import { ok } from '@omni/domain';
import type { Message, OutboundGateway } from '@omni/domain';
import { webSessionKey } from './session';
import { toWirePayload } from './wire';

/**
 * WebConnectionRegistry — apps/api เป็นคน implement (in-memory map: key → live sockets)
 * adapter ประกาศแค่ interface (framework WebSocket อยู่ฝั่ง api ไม่ใช่ adapter — กัน adapter พึ่ง framework)
 */
export interface WebConnectionRegistry {
  /** ส่ง data (JSON string) ไปทุก socket ที่ผูกกับ key → คืนจำนวน socket ที่ส่งถึง (0 = offline) */
  send(key: string, data: string): number;
}

/**
 * WebRouteResolver — จาก outbound message หา externalId (sessionId) ของปลายทางบนช่องทาง web
 * impl จริงอยู่ `@omni/db` (createWebRouteResolver) · inject ที่ composition root (apps/api)
 * (adapter ไม่พึ่ง adapter: type นี้ผูกกับ domain Message เท่านั้น — db แค่คืน function ที่ compatible)
 */
export type WebRouteResolver = (message: Message) => Promise<string | null>;

export interface WebOutboundDeps {
  registry: WebConnectionRegistry;
  resolveRoute: WebRouteResolver;
}

/**
 * OutboundGateway ของ web channel — push outbound message เข้า WS ของ session ที่ต่ออยู่
 *
 * offline (resolve ไม่เจอปลายทาง หรือไม่มี socket ต่ออยู่) = `delivered:false` (ไม่ใช่ error) —
 * message ถูก persist แล้วโดย service · widget จะดึง history ตอน reconnect (Phase 3)
 */
export function createWebOutboundGateway(deps: WebOutboundDeps): OutboundGateway {
  const { registry, resolveRoute } = deps;
  return {
    send: async (message) => {
      const externalId = await resolveRoute(message);
      if (!externalId) {
        return ok({ externalId: null, delivered: false });
      }
      const key = webSessionKey(message.workspaceId, message.channelId, externalId);
      const count = registry.send(key, JSON.stringify(toWirePayload(message)));
      return ok({ externalId: null, delivered: count > 0 });
    },
  };
}
