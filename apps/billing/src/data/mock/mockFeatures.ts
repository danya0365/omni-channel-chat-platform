/**
 * Mock Features Data
 * Master data สำหรับ OmniChat — แพลตฟอร์มรวมแชททุกช่องทางไว้ในจอเดียว
 * 10 โมดูล · ราคาแยก 2 ก้อน: price = ค่าติดตั้ง (one-time) · monthlyPrice = ค่าบริการรายเดือน
 */

// ============================================
// Types
// ============================================

export type FeatureLevel = 'basic' | 'standard' | 'premium';

export interface ProjectType {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  /** ค่าติดตั้งเริ่มต้น (one-time) */
  basePrice: number;
  /** ค่าบริการรายเดือนเริ่มต้น */
  monthlyPrice: number;
}

export interface FeatureCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
}

/** รูปแบบการจ้าง — ตัวคูณราคาทั้งใบ (ราคาใน catalog = เรตถูกสุด solo+AI = ×1.0) */
export interface DeliveryTier {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  /** ใครทำ / เหมาะกับใคร */
  description: string;
  /** แลกอะไรกับอะไร — พูดตรง ไม่ขายฝัน */
  detail: string;
  setupMultiplier: number;
  monthlyMultiplier: number;
}

// ============================================
// Delivery Tiers (รูปแบบการจ้าง)
// ============================================
export const DELIVERY_TIERS: DeliveryTier[] = [
  {
    id: 'solo-ai',
    name: 'Solo dev + AI',
    nameEn: 'Solo + AI-assisted',
    icon: '🤖',
    description: 'นักพัฒนา 1 คน ทำงานคู่กับ AI (vibe coding) — ถูกที่สุด',
    detail:
      'ได้ราคาถูกที่สุดเพราะ AI ช่วยเขียนโค้ดส่วนซ้ำๆ · แลกกับ: คนเดียวดูแลทั้งโปรเจค ถ้าติดธุระงานหยุด · ไม่มี QA แยก ต้องช่วยกันเทสต์ · เหมาะกับ MVP และธุรกิจที่ยอมรับความเสี่ยงได้',
    setupMultiplier: 1.0,
    monthlyMultiplier: 1.0,
  },
  {
    id: 'solo',
    name: 'Solo dev',
    nameEn: 'Solo Developer',
    icon: '👨‍💻',
    description: 'นักพัฒนา 1 คนเต็มตัว เขียน-ทดสอบ-ส่งมอบเอง',
    detail:
      'คนเดิมคุมตั้งแต่ต้นจนจบ เข้าใจระบบลึก แก้งานตรงจุด · แลกกับ: ยังเป็น bus-factor 1 และคิวงานขึ้นกับคนเดียว · เหมาะกับธุรกิจที่อยากได้คนรับผิดชอบชัดเจนแต่ยังไม่ต้องมีทีม',
    setupMultiplier: 1.4,
    monthlyMultiplier: 1.2,
  },
  {
    id: 'small-team',
    name: 'ทีมเล็ก 2-3 คน',
    nameEn: 'Small Team',
    icon: '👥',
    description: 'dev 2-3 คน แบ่งงาน มีคนรีวิวและทดสอบให้กัน',
    detail:
      'ส่งงานเร็วขึ้นเพราะทำขนานกันได้ · มีคนแทนกันเวลาลา · โค้ดผ่านการรีวิว บั๊กหลุดน้อยลง · แลกกับ: ต้นทุนสูงขึ้นและต้องมีการประสานงานภายใน',
    setupMultiplier: 1.9,
    monthlyMultiplier: 1.5,
  },
  {
    id: 'company',
    name: 'บริษัท / ทีมใหญ่',
    nameEn: 'Full Team / Agency',
    icon: '🏢',
    description: 'ทีมเต็มรูปแบบ มี PM / QA / designer แยกบทบาท',
    detail:
      'ได้เอกสารครบ ทดสอบเป็นระบบ มีสัญญาและ SLA ชัดเจน มีคนแทนกันได้เสมอ · แลกกับ: ราคาสูงสุดและกระบวนการเยอะกว่า · เหมาะกับองค์กรที่ต้องผ่านจัดซื้อ/ตรวจรับเป็นทางการ',
    setupMultiplier: 2.6,
    monthlyMultiplier: 2.0,
  },
];

export interface Feature {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  /** ค่าติดตั้ง (one-time) — 0 = รวมอยู่ใน base แล้ว */
  price: number;
  /** ค่าบริการรายเดือน — 0 = ไม่มีค่ารายเดือนเพิ่ม */
  monthlyPrice: number;
  level: FeatureLevel;
  dependencies: string[]; // Feature IDs that must be selected first
  recommendedFor: string[]; // Project Type IDs
  isPopular?: boolean;
}

// ============================================
// Project Types (ประเภทธุรกิจที่ใช้งาน)
// ============================================
export const PROJECT_TYPES: ProjectType[] = [
  {
    id: 'smb',
    name: 'ร้านค้า / SME',
    nameEn: 'Small Business',
    icon: '🏪',
    description: 'ร้านค้า ธุรกิจขนาดเล็ก ตอบลูกค้าจาก LINE และเว็บ',
    basePrice: 12000,
    monthlyPrice: 900,
  },
  {
    id: 'ecommerce',
    name: 'อีคอมเมิร์ซ / แบรนด์',
    nameEn: 'E-commerce',
    icon: '🛒',
    description: 'ขายของออนไลน์หลายแพลตฟอร์ม ปิดการขายผ่านแชท',
    basePrice: 18000,
    monthlyPrice: 1500,
  },
  {
    id: 'service',
    name: 'ธุรกิจบริการ / ศูนย์ซัพพอร์ต',
    nameEn: 'Service & Support',
    icon: '🎧',
    description: 'ทีมซัพพอร์ตหลายคน ต้องคุม SLA และคุณภาพการตอบ',
    basePrice: 22000,
    monthlyPrice: 2000,
  },
  {
    id: 'agency',
    name: 'เอเจนซี่ / หลายแบรนด์',
    nameEn: 'Agency / Multi-brand',
    icon: '🏢',
    description: 'ดูแลลูกค้าหลายเจ้า หลายแบรนด์ บน deployment เดียว',
    basePrice: 28000,
    monthlyPrice: 2800,
  },
];

// ============================================
// Feature Categories (10 Modules)
// ============================================
export const FEATURE_CATEGORIES: FeatureCategory[] = [
  // แยก 2 กลุ่มเพราะต้นทุนคนละเรื่อง: มาตรฐาน = โค้ด adapter (reuse ได้) · พิเศษ = เวลารออนุมัติจาก provider
  { id: 'channel', name: 'ช่องทางแชท (มาตรฐาน)', icon: '💬', order: 1 },
  { id: 'channel-special', name: 'ช่องทางพิเศษ (ต้องขออนุมัติ / สั่งทำ)', icon: '⏳', order: 2 },
  { id: 'inbox', name: 'Agent Inbox', icon: '📥', order: 3 },
  { id: 'routing', name: 'Routing & Assignment', icon: '🎯', order: 4 },
  { id: 'bot', name: 'บอท & Automation', icon: '🤖', order: 5 },
  { id: 'ai', name: 'AI Assist', icon: '✨', order: 6 },
  { id: 'crm', name: 'ลูกค้า & CRM', icon: '👥', order: 7 },
  { id: 'report', name: 'รายงาน & Analytics', icon: '📊', order: 8 },
  { id: 'integration', name: 'เชื่อมต่อระบบอื่น', icon: '🔌', order: 9 },
  { id: 'security', name: 'ความปลอดภัย & สิทธิ์', icon: '🔒', order: 10 },
  { id: 'deploy', name: 'ติดตั้ง & บริการ', icon: '🚀', order: 11 },
];

const ALL_TYPES = ['smb', 'ecommerce', 'service', 'agency'];

// ============================================
// Features
// ============================================
export const FEATURES: Feature[] = [
  // ── Module 1: ช่องทางแชท ──
  {
    id: 'ch-web',
    categoryId: 'channel',
    name: 'Web Chat Widget',
    description: 'แปะ <script> ตัวเดียวบนเว็บ ลูกค้าทักได้ทันที ปรับสี/ข้อความต้อนรับได้',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'ch-line',
    categoryId: 'channel',
    name: 'LINE Official Account',
    description:
      'รับ-ส่งข้อความจาก LINE OA เข้ากล่องเดียวกัน พร้อมชื่อ/รูปโปรไฟล์ลูกค้า — ช่องทางหลักของลูกค้าไทย',
    price: 3500,
    monthlyPrice: 400,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'ch-messenger',
    categoryId: 'channel',
    name: 'Facebook Messenger',
    description:
      'เชื่อม Facebook Page ตอบข้อความจากเพจได้ในจอเดียว · ⚠️ ต้องผ่าน Meta App Review (2-6 สัปดาห์) และมีข้อจำกัดตอบนอก 24 ชม.',
    price: 4000,
    monthlyPrice: 400,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'ch-instagram',
    categoryId: 'channel',
    name: 'Instagram DM',
    description:
      'รับ DM จาก Instagram เข้าระบบเดียวกัน · ⚠️ ต้องผ่าน Meta App Review (2-6 สัปดาห์) และผูกกับ Facebook Page',
    price: 4000,
    monthlyPrice: 400,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['smb', 'ecommerce', 'agency'],
  },
  {
    id: 'ch-whatsapp',
    categoryId: 'channel-special',
    name: 'WhatsApp Business',
    description:
      'เชื่อม WhatsApp Business API เหมาะกับลูกค้าต่างประเทศ · ⚠️ ต้องยืนยันตัวตนธุรกิจกับ Meta + ยืนยันเบอร์ + ข้อความนอก 24 ชม. ต้องใช้ template ที่ขออนุมัติแล้ว (Meta คิดค่าข้อความแยก)',
    price: 14000,
    monthlyPrice: 600,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['ecommerce', 'service', 'agency'],
  },
  {
    id: 'ch-email',
    categoryId: 'channel',
    name: 'อีเมล',
    description:
      'อีเมลลูกค้าเข้ามาเป็นบทสนทนาในกล่องเดียวกัน ตอบกลับได้จากในระบบ',
    price: 3000,
    monthlyPrice: 250,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'ch-telegram',
    categoryId: 'channel',
    name: 'Telegram',
    description:
      'รับ-ส่งข้อความผ่าน Telegram Bot API — ตั้งค่าเร็วที่สุด สมัคร bot เสร็จใน 5 นาที ไม่ต้องรออนุมัติ',
    price: 2000,
    monthlyPrice: 250,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['ecommerce', 'agency'],
  },
  {
    id: 'ch-tiktok',
    categoryId: 'channel-special',
    name: 'TikTok Messages',
    description:
      'รับข้อความจาก TikTok เข้าระบบ · ⚠️ API เปิดจำกัด ต้องสมัครเป็น partner และรออนุมัติ — ประเมินความเป็นไปได้ก่อนเริ่มงาน',
    price: 15000,
    monthlyPrice: 450,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['ecommerce', 'agency'],
  },
  {
    id: 'ch-marketplace',
    categoryId: 'channel-special',
    name: 'Shopee / Lazada Chat',
    description:
      'ดึงแชทจาก Shopee/Lazada เข้ากล่องเดียว ไม่ต้องสลับแอปตอบ · ⚠️ ไม่มี chat API สาธารณะ ต้องสมัคร Open Platform และรออนุมัติ ซึ่งอาจไม่ผ่าน — คิดค่าประเมินก่อนเริ่ม',
    price: 16000,
    monthlyPrice: 700,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['ecommerce', 'agency'],
  },
  {
    id: 'ch-custom',
    categoryId: 'channel-special',
    name: 'Custom Channel (สั่งทำ)',
    description:
      'เขียน adapter ให้ช่องทางเฉพาะของคุณ (in-app chat, ระบบภายใน ฯลฯ) — ราคาขึ้นกับ API ปลายทาง ประเมินเป็นรายกรณี',
    price: 15000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },

  // ── Module 2: Agent Inbox ──
  {
    id: 'inbox-core',
    categoryId: 'inbox',
    name: 'กล่องข้อความรวม (Unified Inbox)',
    description: 'ทุกช่องทางรวมเป็นรูปแบบข้อความกลางตัวเดียว ทีมตอบจากจอเดียว',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'inbox-realtime',
    categoryId: 'inbox',
    name: 'Realtime (WebSocket)',
    description: 'ข้อความเด้งเข้าทันที หลาย agent เห็นตรงกันแบบ sync',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'inbox-history',
    categoryId: 'inbox',
    name: 'ประวัติสนทนารวมศูนย์',
    description: 'ย้อนดูบทสนทนาเต็มของลูกค้าแต่ละคนได้ทุกเมื่อ',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'inbox-search',
    categoryId: 'inbox',
    name: 'ค้นหาข้อความ / ลูกค้า',
    description: 'ค้นหาข้อความหรือชื่อลูกค้าย้อนหลังได้ทั้งระบบ',
    price: 4000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'inbox-canned',
    categoryId: 'inbox',
    name: 'ข้อความสำเร็จรูป (Canned Response)',
    description: 'เก็บคำตอบที่ใช้บ่อย กดส่งได้ในคลิกเดียว ลดเวลาพิมพ์ซ้ำ',
    price: 3500,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'inbox-media',
    categoryId: 'inbox',
    name: 'ส่ง-รับ รูป / ไฟล์ / สติกเกอร์',
    description: 'รองรับสื่อทุกแบบที่แต่ละช่องทางส่งมา พร้อมพรีวิวในกล่องข้อความ',
    price: 6000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'inbox-note',
    categoryId: 'inbox',
    name: 'โน้ตภายใน + mention เพื่อนร่วมทีม',
    description: 'คุยกันในทีมใต้บทสนทนาโดยลูกค้าไม่เห็น แท็กเพื่อนให้มาช่วยได้',
    price: 4000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'inbox-typing',
    categoryId: 'inbox',
    name: 'Typing indicator + สถานะอ่านแล้ว',
    description: 'เห็นว่าอีกฝ่ายกำลังพิมพ์ และรู้ว่าลูกค้าอ่านข้อความแล้วหรือยัง',
    price: 2500,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'inbox-mobile',
    categoryId: 'inbox',
    name: 'แอปมือถือสำหรับ agent (PWA)',
    description: 'ทีมตอบลูกค้าจากมือถือได้ พร้อม push notification',
    price: 12000,
    monthlyPrice: 400,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'inbox-multilang',
    categoryId: 'inbox',
    name: 'หน้าจอหลายภาษา (TH / EN)',
    description: 'สลับภาษาหน้าจอทีมงาน เหมาะกับทีมที่มีคนต่างชาติ',
    price: 5000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },

  // ── Module 3: Routing & Assignment ──
  {
    id: 'route-assign',
    categoryId: 'routing',
    name: 'รับสาย / มอบหมาย / ปิดสาย',
    description: 'กันตอบซ้ำและสายตกหล่น — รู้ชัดว่าใครดูแลสายไหนอยู่',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'route-filter',
    categoryId: 'routing',
    name: 'ฟิลเตอร์คิว (ทั้งหมด / ของฉัน / ยังไม่รับ)',
    description: 'แยกดูเฉพาะสายที่เกี่ยวกับตัวเอง หรือสายที่ยังไม่มีใครรับ',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'route-team',
    categoryId: 'routing',
    name: 'ทีม / แผนก + คิวแยกต่อทีม',
    description: 'แบ่งทีมขาย-ซัพพอร์ต-บัญชี แต่ละทีมเห็นคิวของตัวเอง',
    price: 6000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'route-auto',
    categoryId: 'routing',
    name: 'มอบหมายอัตโนมัติ (Round-robin / โหลดน้อยสุด)',
    description: 'ระบบกระจายสายให้ agent เองอัตโนมัติ ไม่ต้องมีคนคอยแจก',
    price: 7000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['ecommerce', 'service', 'agency'],
    isPopular: true,
  },
  {
    id: 'route-tag',
    categoryId: 'routing',
    name: 'แท็ก & จัดหมวดบทสนทนา',
    description: 'ติดแท็ก (สอบถามราคา / เคลม / ติดตามพัสดุ) เพื่อจัดกลุ่มและทำรายงาน',
    price: 3500,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'route-priority',
    categoryId: 'routing',
    name: 'ระดับความสำคัญ + SLA timer',
    description: 'ตั้งเวลาที่ต้องตอบ นับถอยหลัง และเตือนเมื่อใกล้เกินกำหนด',
    price: 6500,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'route-schedule',
    categoryId: 'routing',
    name: 'เวลาทำการ + ข้อความนอกเวลา',
    description: 'ตั้งเวลาเปิด-ปิด ตอบอัตโนมัตินอกเวลาทำการ ลูกค้าไม่รู้สึกถูกทิ้ง',
    price: 4000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'route-transfer',
    categoryId: 'routing',
    name: 'โอนสาย / escalate ข้ามทีม',
    description: 'ส่งต่อสายให้ทีมอื่นหรือหัวหน้า พร้อมโน้ตส่งต่อ',
    price: 4000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },

  // ── Module 4: บอท & Automation ──
  {
    id: 'bot-rule',
    categoryId: 'bot',
    name: 'บอทตอบอัตโนมัติ (Keyword Rule)',
    description: 'ตั้งคำสำคัญ → ตอบข้อความสำเร็จรูปทันที 24 ชม. คำถามซ้ำๆ ไม่ต้องใช้คน',
    price: 8000,
    monthlyPrice: 400,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'bot-admin-ui',
    categoryId: 'bot',
    name: 'หน้าจัดการ rule (Admin UI)',
    description: 'เพิ่ม/แก้/ปิด rule ของบอทเองผ่านหน้าเว็บ ไม่ต้องเรียกทีมเทค',
    price: 6500,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: ['bot-rule'],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'bot-escalate',
    categoryId: 'bot',
    name: 'ส่งต่อคนจริงอัตโนมัติ',
    description: 'ลูกค้าพิมพ์ "ขอคุยกับแอดมิน" หรือบอทตอบไม่ได้ → เข้าคิวคนทันที',
    price: 2500,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: ['bot-rule'],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'bot-menu',
    categoryId: 'bot',
    name: 'เมนู / ปุ่มโต้ตอบ (Quick Reply)',
    description: 'ให้ลูกค้ากดปุ่มเลือกแทนพิมพ์ ลดความเข้าใจผิดและตอบได้เร็วขึ้น',
    price: 7000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['smb', 'ecommerce', 'agency'],
  },
  {
    id: 'bot-flow',
    categoryId: 'bot',
    name: 'Flow Builder (ลากวางสร้างบทสนทนา)',
    description: 'ออกแบบ flow บอทหลายขั้นแบบลากวาง มีเงื่อนไขแตกแขนงได้',
    price: 18000,
    monthlyPrice: 700,
    level: 'premium',
    dependencies: ['bot-admin-ui'],
    recommendedFor: ['ecommerce', 'agency'],
  },
  {
    id: 'bot-form',
    categoryId: 'bot',
    name: 'เก็บข้อมูลลูกค้าผ่านบอท (Lead Form)',
    description: 'บอทถามชื่อ-เบอร์-ความต้องการ แล้วบันทึกเข้าโปรไฟล์ลูกค้าอัตโนมัติ',
    price: 8000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['smb', 'ecommerce', 'agency'],
  },
  {
    id: 'bot-faq',
    categoryId: 'bot',
    name: 'คลัง FAQ อัตโนมัติ',
    description: 'รวมคำถาม-คำตอบที่พบบ่อย บอทหยิบไปตอบและทีมงานค้นใช้ได้',
    price: 6000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },

  // ── Module 5: AI Assist ──
  {
    id: 'ai-reply',
    categoryId: 'ai',
    name: 'AI ช่วยตอบ (Claude) — beta',
    description: 'คำถามที่ rule ไม่ครอบ ให้ AI ช่วยตอบ ตอบไม่ได้ก็ส่งต่อคนจริง (เปิด/ปิดต่อ workspace)',
    price: 15000,
    monthlyPrice: 2000,
    level: 'premium',
    dependencies: ['bot-rule'],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'ai-suggest',
    categoryId: 'ai',
    name: 'AI แนะนำคำตอบให้ agent',
    description: 'AI ร่างคำตอบขึ้นมาให้ agent ตรวจแล้วกดส่ง — เร็วขึ้นแต่ยังมีคนคุม',
    price: 10000,
    monthlyPrice: 1200,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['ecommerce', 'service', 'agency'],
  },
  {
    id: 'ai-summary',
    categoryId: 'ai',
    name: 'สรุปบทสนทนาอัตโนมัติ',
    description: 'สรุปสายยาวให้อ่านใน 3 บรรทัด ตอนโอนสายหรือปิดเคส',
    price: 8000,
    monthlyPrice: 800,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'ai-sentiment',
    categoryId: 'ai',
    name: 'วิเคราะห์อารมณ์ลูกค้า',
    description: 'จับสายที่ลูกค้าเริ่มไม่พอใจ แล้วดันขึ้นต้นคิวให้หัวหน้าเข้าดู',
    price: 6500,
    monthlyPrice: 600,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'ai-kb',
    categoryId: 'ai',
    name: 'ตอบจากฐานความรู้ของคุณ (RAG)',
    description: 'อัปโหลดคู่มือ/นโยบาย/สเปกสินค้า ให้ AI ตอบอิงเอกสารจริงของธุรกิจ',
    price: 22000,
    monthlyPrice: 2800,
    level: 'premium',
    dependencies: ['ai-reply'],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'ai-translate',
    categoryId: 'ai',
    name: 'แปลภาษาอัตโนมัติ',
    description: 'ลูกค้าทักภาษาอะไรก็ตอบได้ แปลสองทางให้ agent อัตโนมัติ',
    price: 8000,
    monthlyPrice: 1000,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['ecommerce', 'agency'],
  },

  // ── Module 6: ลูกค้า & CRM ──
  {
    id: 'crm-contact',
    categoryId: 'crm',
    name: 'โปรไฟล์ลูกค้ารวมทุกช่องทาง',
    description: 'ลูกค้า 1 คน = 1 โปรไฟล์ พร้อมประวัติทุกบทสนทนา',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'crm-merge',
    categoryId: 'crm',
    name: 'รวมลูกค้าคนเดียวกันข้ามช่องทาง',
    description: 'ลูกค้าคนเดิมทักจาก LINE แล้วมาต่อที่ Messenger — รวมเป็นคนเดียวได้',
    price: 8000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['ecommerce', 'service', 'agency'],
  },
  {
    id: 'crm-field',
    categoryId: 'crm',
    name: 'ฟิลด์ข้อมูลกำหนดเอง',
    description: 'เพิ่มฟิลด์ที่ธุรกิจคุณต้องใช้ (เลขออเดอร์, ประเภทลูกค้า, รอบบิล ฯลฯ)',
    price: 5000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'crm-segment',
    categoryId: 'crm',
    name: 'แบ่งกลุ่มลูกค้า + บันทึกย่อ',
    description: 'จัดกลุ่ม VIP / ลูกค้าใหม่ / ค้างชำระ พร้อมโน้ตประจำตัวลูกค้า',
    price: 6000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['ecommerce', 'service', 'agency'],
  },
  {
    id: 'crm-broadcast',
    categoryId: 'crm',
    name: 'ส่งข้อความกลุ่ม / แคมเปญ',
    description: 'ยิงโปรโมชันหรือแจ้งข่าวหาลูกค้าตามกลุ่มที่เลือก พร้อมสถิติการเปิดอ่าน',
    price: 12000,
    monthlyPrice: 700,
    level: 'premium',
    dependencies: ['crm-contact'],
    recommendedFor: ['smb', 'ecommerce', 'agency'],
  },

  // ── Module 7: รายงาน & Analytics ──
  {
    id: 'rep-basic',
    categoryId: 'report',
    name: 'สรุปพื้นฐาน',
    description: 'จำนวนสายเข้า แยกตามช่องทาง/วัน เห็นภาพรวมงานทีม',
    price: 4000,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'rep-agent',
    categoryId: 'report',
    name: 'ประสิทธิภาพ agent',
    description: 'เวลาตอบเฉลี่ย จำนวนสายที่ปิด รายคน — ใช้ประเมินและจัดกำลังคน',
    price: 6500,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'rep-sla',
    categoryId: 'report',
    name: 'รายงาน SLA / First Response',
    description: 'วัดว่าตอบทันเวลาที่สัญญาไว้กี่ % สายไหนหลุด SLA บ้าง',
    price: 6000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: ['route-priority'],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'rep-csat',
    categoryId: 'report',
    name: 'แบบสอบถามความพึงพอใจ (CSAT)',
    description: 'ส่งให้ลูกค้าให้คะแนนหลังปิดสาย แล้วสรุปเป็นรายงาน',
    price: 7000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'rep-export',
    categoryId: 'report',
    name: 'Export CSV / Excel',
    description: 'ดึงข้อมูลออกไปทำรายงานต่อ หรือส่งเข้าระบบ BI ของบริษัท',
    price: 3500,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'rep-dashboard',
    categoryId: 'report',
    name: 'Dashboard realtime',
    description: 'จอสรุปสดสำหรับหัวหน้าทีม — คิวค้าง เวลารอ สายที่เสี่ยงหลุด',
    price: 9000,
    monthlyPrice: 400,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['ecommerce', 'service', 'agency'],
  },

  // ── Module 8: เชื่อมต่อระบบอื่น ──
  {
    id: 'int-webhook',
    categoryId: 'integration',
    name: 'Webhook ขาออก',
    description: 'ยิง event (ข้อความใหม่ / ปิดสาย) ไปหาระบบอื่นของคุณแบบ realtime',
    price: 4000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'int-api',
    categoryId: 'integration',
    name: 'REST API + API Key',
    description: 'ให้ระบบภายในของคุณอ่าน/ส่งข้อความผ่าน API ได้เอง',
    price: 6500,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'int-crm',
    categoryId: 'integration',
    name: 'เชื่อม CRM ภายนอก',
    description: 'ซิงก์ลูกค้า/ดีล กับ CRM ที่ใช้อยู่ (HubSpot, Salesforce ฯลฯ)',
    price: 15000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['ecommerce', 'service', 'agency'],
  },
  {
    id: 'int-order',
    categoryId: 'integration',
    name: 'เชื่อมระบบออเดอร์ / สต็อก',
    description: 'agent เห็นออเดอร์และสต็อกของลูกค้าข้างบทสนทนา ไม่ต้องเปิดอีกระบบ',
    price: 16000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['ecommerce'],
  },
  {
    id: 'int-payment',
    categoryId: 'integration',
    name: 'ลิงก์ชำระเงินในแชท',
    description: 'สร้างลิงก์จ่ายเงินส่งให้ลูกค้าในแชท ปิดการขายจบในบทสนทนาเดียว',
    price: 12000,
    monthlyPrice: 600,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['smb', 'ecommerce'],
  },
  {
    id: 'int-ticket',
    categoryId: 'integration',
    name: 'เชื่อม Helpdesk / Ticket',
    description: 'เปิด ticket จากบทสนทนา และซิงก์สถานะกลับมาแสดงในกล่องข้อความ',
    price: 10000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service'],
  },

  // ── Module 9: ความปลอดภัย & สิทธิ์ ──
  {
    id: 'sec-auth',
    categoryId: 'security',
    name: 'ล็อกอิน + สิทธิ์พื้นฐาน',
    description: 'ระบบล็อกอินทีมงาน ผูกกับ workspace แยกข้อมูลแต่ละธุรกิจออกจากกัน',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'sec-encrypt',
    categoryId: 'security',
    name: 'เข้ารหัส credential (AES-256-GCM)',
    description: 'token ของแต่ละช่องทางถูกเข้ารหัสเก็บใน DB + ตรวจลายเซ็น webhook ทุกครั้ง',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'sec-rbac',
    categoryId: 'security',
    name: 'สิทธิ์ตามบทบาท (RBAC)',
    description: 'แยกสิทธิ์ admin / หัวหน้าทีม / agent ว่าใครเห็นและทำอะไรได้',
    price: 6500,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'sec-audit',
    categoryId: 'security',
    name: 'Audit Log',
    description: 'บันทึกว่าใครเข้าดู/แก้ไขอะไรเมื่อไหร่ — ใช้ตรวจสอบย้อนหลังได้',
    price: 7000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'sec-sso',
    categoryId: 'security',
    name: 'SSO / Google Workspace',
    description: 'ล็อกอินด้วยบัญชีองค์กร ปิดสิทธิ์พนักงานที่ลาออกได้จากที่เดียว',
    price: 12000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'sec-pdpa',
    categoryId: 'security',
    name: 'เครื่องมือ PDPA',
    description: 'ค้นหา / ส่งออก / ลบข้อมูลลูกค้ารายบุคคลตามคำขอ พร้อมนโยบายเก็บข้อมูล',
    price: 10000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['ecommerce', 'service', 'agency'],
  },
  {
    id: 'sec-2fa',
    categoryId: 'security',
    name: 'ยืนยันตัวตน 2 ชั้น (2FA)',
    description: 'เพิ่มรหัสยืนยันตอนล็อกอิน ลดความเสี่ยงบัญชีทีมงานหลุด',
    price: 5000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },

  // ── Module 10: ติดตั้ง & บริการ ──
  {
    id: 'dep-cloud',
    categoryId: 'deploy',
    name: 'ติดตั้งบน Cloud ของเรา',
    description: 'เราดูแลเซิร์ฟเวอร์ให้ พร้อมใช้งานทันที ไม่ต้องมีทีม IT',
    price: 0,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'dep-onprem',
    categoryId: 'deploy',
    name: 'Self-host / On-premise',
    description: 'ติดตั้งบนเซิร์ฟเวอร์ของคุณเอง ข้อมูลลูกค้าไม่ออกนอกองค์กร',
    price: 15000,
    monthlyPrice: 0,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
    isPopular: true,
  },
  {
    id: 'dep-migrate',
    categoryId: 'deploy',
    name: 'ย้ายข้อมูลจากระบบเดิม',
    description: 'ย้ายประวัติลูกค้า/บทสนทนาจากเครื่องมือเดิมเข้าระบบใหม่',
    price: 10000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ['ecommerce', 'service', 'agency'],
  },
  {
    id: 'dep-training',
    categoryId: 'deploy',
    name: 'อบรมทีมงาน (onsite / online)',
    description: 'สอนทีมใช้งานจริง พร้อมคู่มือ — ทีมเริ่มใช้ได้ตั้งแต่วันแรก',
    price: 5000,
    monthlyPrice: 0,
    level: 'basic',
    dependencies: [],
    recommendedFor: ALL_TYPES,
  },
  {
    id: 'dep-care',
    categoryId: 'deploy',
    name: 'ดูแลระบบ 1 ปี',
    description: 'แก้บั๊ก อัปเดต และดูแลระบบให้ตลอด 1 ปีแรก (เวลาทำการ)',
    price: 20000,
    monthlyPrice: 0,
    level: 'standard',
    dependencies: [],
    recommendedFor: ALL_TYPES,
    isPopular: true,
  },
  {
    id: 'dep-sla247',
    categoryId: 'deploy',
    name: 'ซัพพอร์ต SLA 24/7',
    description: 'ทีมรับแจ้งปัญหาตลอด 24 ชม. พร้อมเวลาตอบสนองที่การันตี',
    price: 30000,
    monthlyPrice: 5000,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['service', 'agency'],
  },
  {
    id: 'dep-whitelabel',
    categoryId: 'deploy',
    name: 'White-label (ใส่แบรนด์ของคุณ)',
    description: 'เปลี่ยนโลโก้/สี/โดเมนเป็นแบรนด์คุณ — เอาไปขายต่อลูกค้าได้',
    price: 13000,
    monthlyPrice: 1200,
    level: 'premium',
    dependencies: [],
    recommendedFor: ['agency'],
  },
];

// ============================================
// Feature Packages (Templates)
// ============================================

export interface FeaturePackage {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  projectTypes: string[]; // Which project types this package is for
  features: string[]; // Feature IDs included
  discountPercent: number; // Package discount
}

/** ฟีเจอร์ core ที่รวมอยู่ใน base price แล้ว (ทุกแพ็กเกจได้ครบ) */
const CORE = [
  'ch-web',
  'inbox-core',
  'inbox-realtime',
  'inbox-history',
  'route-assign',
  'route-filter',
  'crm-contact',
  'sec-auth',
  'sec-encrypt',
  'dep-cloud',
];

export const FEATURE_PACKAGES: FeaturePackage[] = [
  // === ร้านค้า / SME ===
  {
    id: 'smb-starter',
    name: 'แพ็กเกจเริ่มต้น',
    nameEn: 'Starter',
    icon: '🎯',
    description: 'LINE + เว็บ ตอบจากจอเดียว เริ่มใช้ได้เร็ว',
    projectTypes: ['smb'],
    features: [...CORE, 'ch-line', 'inbox-canned', 'route-tag'],
    discountPercent: 0,
  },
  {
    id: 'smb-standard',
    name: 'แพ็กเกจมาตรฐาน',
    nameEn: 'Standard',
    icon: '⭐',
    description: 'เพิ่ม Messenger + บอทตอบอัตโนมัติ + รายงาน',
    projectTypes: ['smb'],
    features: [
      ...CORE,
      'ch-line',
      'ch-messenger',
      'inbox-canned',
      'inbox-media',
      'inbox-search',
      'route-tag',
      'route-schedule',
      'bot-rule',
      'bot-escalate',
      'rep-basic',
    ],
    discountPercent: 5,
  },
  {
    id: 'smb-premium',
    name: 'แพ็กเกจพรีเมียม',
    nameEn: 'Premium',
    icon: '👑',
    description: 'ครบ 3 ช่องทาง + AI ช่วยตอบ + แคมเปญ + อบรม/ดูแล 1 ปี',
    projectTypes: ['smb'],
    features: [
      ...CORE,
      'ch-line',
      'ch-messenger',
      'ch-instagram',
      'inbox-canned',
      'inbox-media',
      'inbox-search',
      'inbox-typing',
      'route-tag',
      'route-schedule',
      'bot-rule',
      'bot-escalate',
      'bot-admin-ui',
      'bot-menu',
      'bot-faq',
      'ai-reply',
      'crm-field',
      'crm-broadcast',
      'rep-basic',
      'rep-export',
      'int-payment',
      'dep-training',
      'dep-care',
    ],
    discountPercent: 12,
  },

  // === อีคอมเมิร์ซ / แบรนด์ ===
  {
    id: 'ecommerce-starter',
    name: 'แพ็กเกจเริ่มต้น',
    nameEn: 'Starter',
    icon: '🎯',
    description: 'LINE + Messenger + ส่งรูปสินค้า ปิดการขายในแชท',
    projectTypes: ['ecommerce'],
    features: [...CORE, 'ch-line', 'ch-messenger', 'inbox-media', 'inbox-canned'],
    discountPercent: 0,
  },
  {
    id: 'ecommerce-standard',
    name: 'แพ็กเกจมาตรฐาน',
    nameEn: 'Standard',
    icon: '⭐',
    description: 'เพิ่ม IG + marketplace + บอท + กระจายสายอัตโนมัติ',
    projectTypes: ['ecommerce'],
    features: [
      ...CORE,
      'ch-line',
      'ch-messenger',
      'ch-instagram',
      'ch-marketplace',
      'inbox-media',
      'inbox-canned',
      'inbox-search',
      'route-tag',
      'route-auto',
      'bot-rule',
      'bot-escalate',
      'bot-menu',
      'rep-basic',
      'rep-export',
    ],
    discountPercent: 5,
  },
  {
    id: 'ecommerce-premium',
    name: 'แพ็กเกจพรีเมียม',
    nameEn: 'Premium',
    icon: '👑',
    description: 'ครบทุกช่องทาง + AI + เชื่อมออเดอร์/ชำระเงิน + dashboard',
    projectTypes: ['ecommerce'],
    features: [
      ...CORE,
      'ch-line',
      'ch-messenger',
      'ch-instagram',
      'ch-whatsapp',
      'ch-tiktok',
      'ch-marketplace',
      'inbox-media',
      'inbox-canned',
      'inbox-search',
      'inbox-typing',
      'route-tag',
      'route-auto',
      'route-schedule',
      'bot-rule',
      'bot-escalate',
      'bot-admin-ui',
      'bot-menu',
      'bot-form',
      'ai-reply',
      'ai-suggest',
      'crm-merge',
      'crm-segment',
      'crm-broadcast',
      'int-order',
      'int-payment',
      'rep-basic',
      'rep-agent',
      'rep-export',
      'rep-dashboard',
      'dep-migrate',
      'dep-training',
      'dep-care',
    ],
    discountPercent: 12,
  },

  // === ธุรกิจบริการ / ศูนย์ซัพพอร์ต ===
  {
    id: 'service-starter',
    name: 'แพ็กเกจเริ่มต้น',
    nameEn: 'Starter',
    icon: '🎯',
    description: 'LINE + อีเมล + โน้ตภายใน สำหรับทีมซัพพอร์ตขนาดเล็ก',
    projectTypes: ['service'],
    features: [...CORE, 'ch-line', 'ch-email', 'inbox-canned', 'inbox-note'],
    discountPercent: 0,
  },
  {
    id: 'service-standard',
    name: 'แพ็กเกจมาตรฐาน',
    nameEn: 'Standard',
    icon: '⭐',
    description: 'ทีม/แผนก + SLA + บอทคัดกรอง + รายงาน SLA',
    projectTypes: ['service'],
    features: [
      ...CORE,
      'ch-line',
      'ch-email',
      'ch-messenger',
      'inbox-canned',
      'inbox-note',
      'inbox-search',
      'inbox-media',
      'route-team',
      'route-tag',
      'route-priority',
      'route-transfer',
      'route-schedule',
      'bot-rule',
      'bot-escalate',
      'rep-basic',
      'rep-sla',
    ],
    discountPercent: 5,
  },
  {
    id: 'service-premium',
    name: 'แพ็กเกจพรีเมียม',
    nameEn: 'Premium',
    icon: '👑',
    description: 'ครบ AI ช่วยทีม + CSAT + RBAC/Audit + ซัพพอร์ตเต็มรูปแบบ',
    projectTypes: ['service'],
    features: [
      ...CORE,
      'ch-line',
      'ch-email',
      'ch-messenger',
      'ch-whatsapp',
      'inbox-canned',
      'inbox-note',
      'inbox-search',
      'inbox-media',
      'inbox-mobile',
      'route-team',
      'route-tag',
      'route-priority',
      'route-transfer',
      'route-schedule',
      'route-auto',
      'bot-rule',
      'bot-escalate',
      'bot-admin-ui',
      'bot-faq',
      'ai-reply',
      'ai-suggest',
      'ai-summary',
      'ai-sentiment',
      'crm-field',
      'crm-segment',
      'rep-basic',
      'rep-agent',
      'rep-sla',
      'rep-csat',
      'rep-export',
      'rep-dashboard',
      'sec-rbac',
      'sec-audit',
      'int-ticket',
      'dep-training',
      'dep-care',
    ],
    discountPercent: 12,
  },

  // === เอเจนซี่ / หลายแบรนด์ ===
  {
    id: 'agency-starter',
    name: 'แพ็กเกจเริ่มต้น',
    nameEn: 'Starter',
    icon: '🎯',
    description: 'หลายแบรนด์บนระบบเดียว แยกทีมดูแลได้',
    projectTypes: ['agency'],
    features: [...CORE, 'ch-line', 'ch-messenger', 'route-team', 'inbox-canned'],
    discountPercent: 0,
  },
  {
    id: 'agency-standard',
    name: 'แพ็กเกจมาตรฐาน',
    nameEn: 'Standard',
    icon: '⭐',
    description: 'เพิ่ม IG/อีเมล + บอท + กระจายสาย + รายงานรายทีม + RBAC',
    projectTypes: ['agency'],
    features: [
      ...CORE,
      'ch-line',
      'ch-messenger',
      'ch-instagram',
      'ch-email',
      'inbox-canned',
      'inbox-note',
      'inbox-search',
      'route-team',
      'route-tag',
      'route-auto',
      'route-transfer',
      'bot-rule',
      'bot-escalate',
      'rep-basic',
      'rep-agent',
      'rep-export',
      'sec-rbac',
    ],
    discountPercent: 5,
  },
  {
    id: 'agency-premium',
    name: 'แพ็กเกจพรีเมียม',
    nameEn: 'Premium',
    icon: '👑',
    description: 'ครบทุกโมดูล + AI + white-label + self-host — เอาไปขายต่อได้เลย',
    projectTypes: ['agency'],
    features: [
      ...CORE,
      'ch-line',
      'ch-messenger',
      'ch-instagram',
      'ch-email',
      'ch-whatsapp',
      'ch-marketplace',
      'inbox-canned',
      'inbox-note',
      'inbox-search',
      'inbox-media',
      'inbox-mobile',
      'inbox-multilang',
      'route-team',
      'route-tag',
      'route-auto',
      'route-transfer',
      'route-priority',
      'route-schedule',
      'bot-rule',
      'bot-escalate',
      'bot-admin-ui',
      'bot-menu',
      'bot-flow',
      'ai-reply',
      'ai-suggest',
      'ai-translate',
      'crm-merge',
      'crm-field',
      'crm-segment',
      'crm-broadcast',
      'rep-basic',
      'rep-agent',
      'rep-sla',
      'rep-csat',
      'rep-export',
      'rep-dashboard',
      'int-webhook',
      'int-api',
      'sec-rbac',
      'sec-audit',
      'sec-sso',
      'dep-whitelabel',
      'dep-onprem',
      'dep-migrate',
      'dep-training',
      'dep-care',
    ],
    discountPercent: 12,
  },
];

// ============================================
// Platforms
// ============================================

export interface Platform {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  basePrice: number;
  monthlyPrice: number;
  priceMultiplier: number;
}

export const PLATFORMS: Platform[] = [
  {
    id: 'web',
    name: 'Web App',
    nameEn: 'Web Application',
    icon: '💻',
    description: 'ทีมงานเข้าใช้ผ่าน Browser ได้ทุกอุปกรณ์ ไม่ต้องติดตั้ง',
    basePrice: 0,
    monthlyPrice: 0,
    priceMultiplier: 1.0,
  },
  {
    id: 'mobile',
    name: 'Mobile App',
    nameEn: 'Mobile Application',
    icon: '📱',
    description: 'แอป agent สำหรับ iOS และ Android พร้อม push notification',
    basePrice: 15000,
    monthlyPrice: 700,
    priceMultiplier: 1.3,
  },
];

// ============================================
// Helper Functions
// ============================================

export function getPlatformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function getDeliveryTierById(id: string | null): DeliveryTier | undefined {
  if (!id) return undefined;
  return DELIVERY_TIERS.find((t) => t.id === id);
}

/** คูณค่าติดตั้งตามรูปแบบการจ้าง — tier ที่ไม่รู้จัก/ว่าง = ×1.0 */
export function tierSetup(amount: number, tierId: string | null): number {
  const tier = getDeliveryTierById(tierId);
  return Math.round(amount * (tier?.setupMultiplier ?? 1));
}

/** คูณค่าบริการรายเดือนตามรูปแบบการจ้าง (ตัวคูณต่ำกว่า setup — monthly ส่วนใหญ่เป็น infra) */
export function tierMonthly(amount: number, tierId: string | null): number {
  const tier = getDeliveryTierById(tierId);
  return Math.round(amount * (tier?.monthlyMultiplier ?? 1));
}

export function calculatePlatformPrice(selectedPlatforms: string[]): number {
  return selectedPlatforms.reduce((total, platformId) => {
    const platform = getPlatformById(platformId);
    return total + (platform?.basePrice ?? 0);
  }, 0);
}

export function getHighestPriceMultiplier(selectedPlatforms: string[]): number {
  if (selectedPlatforms.length === 0) return 1.0;

  return selectedPlatforms.reduce((highest, platformId) => {
    const platform = getPlatformById(platformId);
    return Math.max(highest, platform?.priceMultiplier ?? 1.0);
  }, 1.0);
}

export function getFeaturesByCategory(categoryId: string): Feature[] {
  return FEATURES.filter((f) => f.categoryId === categoryId);
}

export function getFeatureById(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id);
}

export function getProjectTypeById(id: string): ProjectType | undefined {
  return PROJECT_TYPES.find((p) => p.id === id);
}

export function getCategoryById(id: string): FeatureCategory | undefined {
  return FEATURE_CATEGORIES.find((c) => c.id === id);
}

export function getPackagesForProjectType(projectTypeId: string): FeaturePackage[] {
  return FEATURE_PACKAGES.filter((p) => p.projectTypes.includes(projectTypeId));
}

export function getPackageById(id: string): FeaturePackage | undefined {
  return FEATURE_PACKAGES.find((p) => p.id === id);
}

export function calculatePackagePrice(pkg: FeaturePackage, projectTypeId: string): number {
  const projectType = getProjectTypeById(projectTypeId);
  const basePrice = projectType?.basePrice ?? 0;

  const featuresPrice = pkg.features.reduce((total, featureId) => {
    const feature = getFeatureById(featureId);
    return total + (feature?.price ?? 0);
  }, 0);

  // แพ็กเกจส่วนใหญ่มีหลายช่องทาง → ต้องหักส่วนลดหลายช่องทางเหมือนตอนเลือกเอง ไม่งั้นการ์ดโชว์แพงกว่าจริง
  const subtotal = basePrice + featuresPrice - calculateChannelDiscount(pkg.features);
  const discount = Math.round(subtotal * (pkg.discountPercent / 100));
  return subtotal - discount;
}

/** ค่าบริการรายเดือนของแพ็กเกจ (ไม่คิดส่วนลด — ส่วนลดใช้กับค่าติดตั้งเท่านั้น) */
export function calculatePackageMonthlyPrice(
  pkg: FeaturePackage,
  projectTypeId: string,
): number {
  const projectType = getProjectTypeById(projectTypeId);
  const base = projectType?.monthlyPrice ?? 0;

  return pkg.features.reduce((total, featureId) => {
    const feature = getFeatureById(featureId);
    return total + (feature?.monthlyPrice ?? 0);
  }, base);
}

/** ส่วนลดช่องทางมาตรฐานที่ 2 เป็นต้นไป (%) — ตัวแรกรับค่าวางระบบ ที่เหลือ reuse adapter pattern เดิม */
export const MULTI_CHANNEL_DISCOUNT_PERCENT = 30;

/**
 * เพดานค่าติดตั้ง **ช่องทางมาตรฐานรวมกัน** (บาท, เรตฐาน)
 * ช่องทางแชทคือเหตุผลที่ลูกค้าเดินเข้ามา (ไม่ใช่ nice-to-have) — ต้องกล้าเลือกครบโดยไม่กลัวบานปลาย
 * ⚠️ เพดานนี้ใช้กับกลุ่ม 'channel' เท่านั้น · 'channel-special' (WhatsApp/TikTok/marketplace/custom)
 *    ไม่เข้าเพดานและไม่ได้ส่วนลด เพราะต้นทุนคือ "เวลารออนุมัติจาก provider" ไม่ใช่โค้ดที่ reuse ได้
 */
export const STANDARD_CHANNEL_CAP = 10000;

/**
 * ส่วนลดชุดช่องทางมาตรฐาน = (ส่วนลดตัวที่ 2 เป็นต้นไป 30%) + (ส่วนที่เกินเพดาน)
 * คืนค่าเป็น "จำนวนเงินที่ลด" ที่เรตฐาน (ยังไม่คูณ delivery tier)
 */
export function calculateChannelDiscount(selectedFeatures: string[]): number {
  const prices = selectedFeatures
    .map((id) => getFeatureById(id))
    .filter((f): f is Feature => !!f && f.categoryId === 'channel' && f.price > 0)
    .map((f) => f.price)
    .sort((a, b) => b - a);

  if (prices.length === 0) return 0;

  const fullPrice = prices.reduce((sum, p) => sum + p, 0);

  // ตัวแพงสุดคิดเต็ม ที่เหลือลด 30%
  const rest = prices.slice(1).reduce((sum, p) => sum + p, 0);
  const afterDiscount = prices[0] + rest * (1 - MULTI_CHANNEL_DISCOUNT_PERCENT / 100);

  // แล้วครอบด้วยเพดาน — เลือกครบแค่ไหนก็ไม่เกิน STANDARD_CHANNEL_CAP
  const payable = Math.min(afterDiscount, STANDARD_CHANNEL_CAP);

  return Math.round(fullPrice - payable);
}

export function checkDependencies(featureId: string, selectedFeatures: string[]): boolean {
  const feature = getFeatureById(featureId);
  if (!feature) return false;

  return feature.dependencies.every((depId) => selectedFeatures.includes(depId));
}

export function getMissingDependencies(featureId: string, selectedFeatures: string[]): Feature[] {
  const feature = getFeatureById(featureId);
  if (!feature) return [];

  return feature.dependencies
    .filter((depId) => !selectedFeatures.includes(depId))
    .map((depId) => getFeatureById(depId))
    .filter((f): f is Feature => f !== undefined);
}

export function getDependentFeatures(featureId: string): Feature[] {
  return FEATURES.filter((f) => f.dependencies.includes(featureId));
}

/** ค่าติดตั้ง (one-time) = base ของประเภทธุรกิจ + ค่าติดตั้งของฟีเจอร์ที่เลือก */
export function calculateTotalPrice(
  projectTypeId: string | null,
  selectedFeatures: string[],
): number {
  const projectType = projectTypeId ? getProjectTypeById(projectTypeId) : null;
  const basePrice = projectType?.basePrice ?? 0;

  const featuresPrice = selectedFeatures.reduce((total, featureId) => {
    const feature = getFeatureById(featureId);
    return total + (feature?.price ?? 0);
  }, 0);

  return basePrice + featuresPrice;
}

/** ค่าบริการรายเดือน = base รายเดือน + รายเดือนของฟีเจอร์/platform ที่เลือก */
export function calculateMonthlyTotal(
  projectTypeId: string | null,
  selectedFeatures: string[],
  selectedPlatforms: string[] = [],
): number {
  const projectType = projectTypeId ? getProjectTypeById(projectTypeId) : null;
  const base = projectType?.monthlyPrice ?? 0;

  const featuresMonthly = selectedFeatures.reduce((total, featureId) => {
    const feature = getFeatureById(featureId);
    return total + (feature?.monthlyPrice ?? 0);
  }, 0);

  const platformsMonthly = selectedPlatforms.reduce((total, platformId) => {
    const platform = getPlatformById(platformId);
    return total + (platform?.monthlyPrice ?? 0);
  }, 0);

  return base + featuresMonthly + platformsMonthly;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}
