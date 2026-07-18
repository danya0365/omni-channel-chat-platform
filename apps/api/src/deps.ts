import type {
  ChannelRepository,
  createIngestInboundMessage,
  createSendOutboundMessage,
} from '@omni/domain';
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
  sendOutbound: ReturnType<typeof createSendOutboundMessage>;
  registry: ConnectionRegistry;
  /** สร้าง sessionId ใหม่ (สุ่ม) — inject เพื่อ test deterministic + แยก crypto ออกจาก route */
  newSessionId: () => string;
}
