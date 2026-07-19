import { err, ok } from '@omni/domain';
import type { Message, MessageContent, OutboundGateway } from '@omni/domain';
import type { LineCredentialResolver } from './credentials';

/**
 * LineRouteResolver — จาก outbound message หา LINE userId ปลายทาง (null = ยังไม่รู้ identity)
 * impl จริงอยู่ `@omni/db` (route resolver ตาม contact_identities) — bridge ที่ composition root
 */
export type LineRouteResolver = (message: Message) => Promise<string | null>;

/** 1 LINE message object (MVP: text เท่านั้น) */
export interface LineTextMessage {
  type: 'text';
  text: string;
}

export interface LinePushRequest {
  accessToken: string;
  /** LINE userId ปลายทาง */
  to: string;
  messages: LineTextMessage[];
}

export type LinePushResult =
  { ok: true; requestId: string | null } | { ok: false; status: number; message: string };

/** client ยิง LINE push API — inject เพื่อ test ได้โดยไม่ยิง network จริง (ดู push-client.ts เป็น default) */
export type LinePushClient = (request: LinePushRequest) => Promise<LinePushResult>;

export interface LineOutboundDeps {
  resolveRoute: LineRouteResolver;
  resolveCredentials: LineCredentialResolver;
  push: LinePushClient;
}

/** map unified content → LINE messages (MVP text เท่านั้น · อื่นๆ คืน null = ยังส่งไม่ได้) */
function toLineMessages(content: MessageContent): LineTextMessage[] | null {
  if (content.type === 'text') return [{ type: 'text', text: content.text }];
  return null;
}

/**
 * OutboundGateway ของ LINE — push outbound message ไปหา user ผ่าน LINE push API
 *
 * - resolveRoute = null (ยังไม่มี identity) → delivered:false (ไม่ใช่ error)
 * - ไม่มี credential ตั้งไว้ → send_failed (config ผิด — ควรรู้)
 * - content ยังไม่รองรับ (non-text) → delivered:false (MVP ข้าม ไม่ push)
 * - push HTTP ล้ม → send_failed (caller ตัดสิน retry ระดับบน — MVP ไม่ retry เอง · ADR-0004)
 * ⚠️ message ถูก persist โดย service ก่อนเรียก gateway แล้ว — delivered:false ไม่ทำให้ข้อความหาย
 */
export function createLineOutboundGateway(deps: LineOutboundDeps): OutboundGateway {
  const { resolveRoute, resolveCredentials, push } = deps;
  return {
    send: async (message) => {
      const to = await resolveRoute(message);
      if (!to) return ok({ externalId: null, delivered: false });

      const credentials = await resolveCredentials(message.workspaceId, message.channelId);
      if (!credentials) {
        return err({
          code: 'send_failed',
          message: 'line credentials not configured for channel',
        });
      }

      const messages = toLineMessages(message.content);
      if (!messages) return ok({ externalId: null, delivered: false });

      const result = await push({
        accessToken: credentials.channelAccessToken,
        to,
        messages,
      });
      if (!result.ok) {
        return err({ code: 'send_failed', message: `line push failed (status ${result.status})` });
      }
      return ok({ externalId: result.requestId, delivered: true });
    },
  };
}
