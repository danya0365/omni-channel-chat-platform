import type {
  ChannelRepository,
  ContactId,
  ConversationId,
  ConversationRepository,
  InboxReadRepository,
  ManageConversation,
  SendOutboundMessage,
  WorkspaceId,
  createIngestInboundMessage,
} from '@omni/domain';
import type { LineCredentialResolver, LineProfileResolver } from '@omni/channel-line';
import type { AuthService } from './auth/service';
import type { ConnectionRegistry } from './registry';

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
  /** auth ของ agent (login + verify token) — Phase 3 */
  auth: AuthService;
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
