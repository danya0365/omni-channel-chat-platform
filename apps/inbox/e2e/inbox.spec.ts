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
