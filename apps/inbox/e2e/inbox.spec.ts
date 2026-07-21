import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * e2e จริงบนเบราว์เซอร์ (headless) — พิสูจน์ว่า inbox หลัง refactor hexagonal ยังทำงานครบ:
 *   login → เห็นสายจาก DB → รับเรื่อง (assign) → ตอบ (reply) → realtime sync ข้ามแท็บ
 * inbound สร้างผ่าน web channel endpoint จริง (chn_web_demo จาก seed)
 */

const API = 'http://localhost:4001';
const WEB_CHANNEL = 'chn_web_demo';

let counter = 0;
/** สร้าง inbound message ใหม่ผ่าน web channel (สายใหม่ต่อ sessionId) → คืน text ที่ยิงเข้าไป */
async function createInbound(request: APIRequestContext, label: string): Promise<string> {
  counter += 1;
  const stamp = `${label} #${counter}-${Math.floor(performance.now())}`;
  const res = await request.post(`${API}/channels/web/${WEB_CHANNEL}/messages`, {
    data: {
      sessionId: `e2e_${counter}_${Math.floor(performance.now())}`,
      text: stamp,
      contactName: 'ลูกค้า e2e',
    },
  });
  expect(res.ok(), `create inbound failed: ${res.status()}`).toBeTruthy();
  return stamp;
}

/**
 * ปิด/เปิดบอทผ่าน API จริง (Phase 6) — seed เปิดบอทไว้ให้ demo ซึ่งจะแย่งตอบสายก่อน agent
 * เทสต์ agent flow จึงต้องปิดบอทก่อน (เทสต์ของจอบอทจัดการสวิตช์เอง)
 */
async function setBotEnabled(request: APIRequestContext, botEnabled: boolean): Promise<void> {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: 'agent@demo.local', password: 'demo1234' },
  });
  expect(login.ok(), `api login failed: ${login.status()}`).toBeTruthy();
  const res = await request.put(`${API}/inbox/bot/config`, {
    data: { botEnabled, aiEnabled: false },
  });
  expect(res.ok(), `set bot config failed: ${res.status()}`).toBeTruthy();
}

test.beforeEach(async ({ request }) => {
  await setBotEnabled(request, false);
});

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.fill('#login-email', 'agent@demo.local');
  await page.fill('#login-password', 'demo1234');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  // login สำเร็จ → ฟอร์มหาย (SessionGate สลับไป Inbox)
  await expect(page.locator('#login-email')).toHaveCount(0);
}

/** แถวสนทนาในลิสต์ (เป็น <button> ที่มี text ข้อความล่าสุด) */
function conversationRow(page: Page, text: string) {
  return page.getByRole('button').filter({ hasText: text });
}

test('single agent: login → เห็นสาย → รับเรื่อง → ตอบ', async ({ page, request }) => {
  const inboundText = await createInbound(request, 'อยากสอบถามออเดอร์');
  await login(page);

  // 1. สายโผล่ในลิสต์ (ดึงจาก DB จริง)
  const row = conversationRow(page, inboundText);
  await expect(row).toBeVisible();
  await row.click();

  // 2. เปิดสาย → เห็นข้อความ inbound ใน thread (เจาะ bubble <p> — text ปรากฏใน row ด้วย)
  await expect(page.getByRole('paragraph').filter({ hasText: inboundText })).toBeVisible();

  // 3. รับเรื่อง (assign) → ปุ่มสลับเป็น "คืนสาย" (mine=true)
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await expect(page.getByRole('button', { name: 'คืนสาย' })).toBeVisible();

  // 4. ตอบ (reply) → ข้อความขึ้นใน thread (optimistic + WS echo)
  const replyText = `รับเรื่องแล้วครับ ${Math.floor(performance.now())}`;
  await page.getByLabel('ข้อความตอบ').fill(replyText);
  await page.getByRole('button', { name: 'ส่ง' }).click();
  await expect(page.getByRole('paragraph').filter({ hasText: replyText })).toBeVisible();
});

test('realtime: inbound ใหม่เด้งเข้าทั้ง 2 แท็บผ่าน WS', async ({ browser, request }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await login(a);
  await login(b);
  // ให้ WS ทั้งสองแท็บต่อเสร็จก่อนยิง inbound (event ใหม่ต้อง fan-out ผ่าน WS ไม่ใช่ initial fetch)
  await a.waitForTimeout(1500);

  const inboundText = await createInbound(request, 'สายใหม่ realtime');

  // ทั้ง 2 แท็บต้องเห็นสายใหม่โดยไม่ต้อง reload (WS agent fan-out)
  await expect(conversationRow(a, inboundText)).toBeVisible();
  await expect(conversationRow(b, inboundText)).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

/**
 * Phase 6 — จอตั้งค่าบอทโผล่เพราะ workspace demo **ซื้อโมดูล bot** (seed เปิดครบทุกโมดูล)
 * ครบวง: เปิดจอ → เพิ่มกติกา → เห็นในลิสต์ → เปิด/ปิดบอท → ลบกติกาทิ้ง (ไม่ทิ้งขยะให้เทสต์อื่น)
 */
test('bot admin: เมนูตั้งค่าบอทโผล่ (ซื้อโมดูล bot) → เพิ่ม/ปิด/ลบกติกาได้จริง', async ({
  page,
}) => {
  await login(page);

  await page.getByRole('button', { name: 'ตั้งค่าบอท' }).click();
  await expect(page.getByText('บอทตอบเองเมื่อลูกค้าทักตามคำที่กำหนด')).toBeVisible();

  // สวิตช์โหลดค่าจริงจาก server (beforeEach ปิดบอทไว้) → กดเปิดแล้วต้องสลับสถานะ
  const botToggle = page.getByRole('button', { name: /เปิดบอทตอบอัตโนมัติ/ });
  await expect(botToggle).toHaveAttribute('aria-pressed', 'false');
  await botToggle.click();
  await expect(botToggle).toHaveAttribute('aria-pressed', 'true');
  await botToggle.click(); // ปิดคืน (เทสต์อื่นคาดว่าบอทปิด)
  await expect(botToggle).toHaveAttribute('aria-pressed', 'false');

  // เพิ่มกติกาใหม่ → โผล่ในลิสต์ (persist จริงผ่าน API)
  const keyword = `จัดส่ง-${Math.floor(performance.now())}`;
  await page.getByLabel('คำที่ต้องเจอในข้อความลูกค้า').fill(keyword);
  await page.getByLabel('ข้อความที่บอทจะตอบ').fill('ส่งภายใน 2 วันครับ');
  await page.getByRole('button', { name: 'เพิ่มกติกา' }).click();

  const row = page.getByRole('listitem').filter({ hasText: keyword });
  await expect(row).toBeVisible();
  await expect(row).toContainText('ตอบ: ส่งภายใน 2 วันครับ');

  // ปิดกติกา → ปุ่มสลับเป็น "เปิด" (สถานะมาจาก response จริง)
  await row.getByRole('button', { name: 'ปิด' }).click();
  await expect(row.getByRole('button', { name: 'เปิด' })).toBeVisible();

  // ลบทิ้ง → หายจากลิสต์
  await row.getByRole('button', { name: 'ลบ' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: keyword })).toHaveCount(0);
});
