import type {
  ChannelRepository,
  ContactId,
  ConversationId,
  ConversationRepository,
  InboxReadRepository,
  ManageBotRules,
  ManageConversation,
  SendOutboundMessage,
  WorkspaceEntitlementsRepository,
  WorkspaceId,
  createIngestInboundMessage,
} from '@omni/domain';
import type { LineCredentialResolver, LineProfileResolver } from '@omni/channel-line';
import type { AuthService } from './auth/service';
import type { ConnectionRegistry } from './registry';

/**
 * ตั้งค่า session cookie + CSRF Origin check — auth transport = httpOnly cookie (ADR-0005)
 * cookie httpOnly+SameSite=Strict = token ไม่โดน XSS อ่าน + ไม่ถูกส่ง cross-site · Origin check = defense-in-depth
 */
export interface SessionCookieConfig {
  /** ชื่อ cookie ที่เก็บ session token */
  cookieName: string;
  /** ส่ง cookie เฉพาะ HTTPS (prod=true) · dev http localhost = Chromium ยอมส่งอยู่แล้ว */
  secure: boolean;
  /** อายุ cookie (วินาที) — ตรงกับ token ttl */
  maxAgeSec: number;
  /** origins ที่ยอมให้ยิง state-changing request (CSRF Origin check) · ว่าง = ปิด check (dev/test) */
  allowedOrigins: string[];
}

/**
 * AppDeps — collaborators ที่ route ต้องใช้ · ประกอบจริงที่ composition root (createContainer ใน wiring.ts)
 * inject เข้ามาเพื่อให้ buildApp ทดสอบได้ด้วย fake (ไม่ต้องมี DB จริงตอน unit/contract test)
 *
 * แยกไฟล์จาก app.ts/routes เพื่อตัด circular (app ↔ routes ต่างพึ่ง type เดียวกัน)
 */
export interface AppDeps {
  channels: ChannelRepository;
  ingest: ReturnType<typeof createIngestInboundMessage>;
  sendOutbound: SendOutboundMessage;
  /** registry ของ web widget (key = session ลูกค้า) — push outbound เข้า widget */
  registry: ConnectionRegistry;
  /** registry ของ agent inbox (key = workspaceId) — push event realtime เข้าจอทีมงาน (Phase 3) */
  agentRegistry: ConnectionRegistry;
  /** read-model ของ inbox (list conversation / message history) */
  inboxRead: InboxReadRepository;
  /** resolve conversation (ใช้ตอน agent reply เพื่อรู้ channel ของสาย) */
  conversations: ConversationRepository;
  /** assign/unassign/close/reopen conversation (Phase 4 routing) */
  manageConversation: ManageConversation;
  /**
   * โมดูลที่ workspace ซื้อไว้ (Phase 6 · ADR-0007) — **server เป็นเจ้าของสิทธิ์** UI แค่ซ่อนเมนู
   * ไม่มี row = ไม่มีสิทธิ์เลย (fail-closed) · เช็คด้วย `hasEntitlement` จาก @omni/domain
   */
  entitlements: WorkspaceEntitlementsRepository;
  /** จอจัดการ bot ของ workspace (Phase 6) — CRUD rules + สวิตช์ bot/AI · route gate ด้วยโมดูล `bot` */
  manageBotRules: ManageBotRules;
  /** auth ของ agent (login + verify token) — Phase 3 */
  auth: AuthService;
  /** ตั้งค่า session cookie + CSRF Origin allowlist — auth transport = httpOnly cookie (ADR-0005) */
  session: SessionCookieConfig;
  /** สร้าง sessionId ใหม่ (สุ่ม) — inject เพื่อ test deterministic + แยก crypto ออกจาก route */
  newSessionId: () => string;
  /** resolve LINE credentials (decrypt) — webhook route ใช้ verify x-line-signature (Phase 4) */
  lineCredentials: LineCredentialResolver;
  /** resolve ชื่อ contact จาก LINE profile API — route เรียกตอนสร้าง contact ใหม่ (คืน null ถ้าล้ม) */
  lineProfile: LineProfileResolver;
  /** backfill ชื่อ contact + broadcast conversation.updated (inbox refresh ชื่อ realtime) */
  updateContactName: (
    workspaceId: WorkspaceId,
    contactId: ContactId,
    conversationId: ConversationId,
    displayName: string,
  ) => Promise<void>;
}
