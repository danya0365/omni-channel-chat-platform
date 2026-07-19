import { describe, expect, it, vi } from 'vitest';
import type { Message } from '@omni/domain';
import { webSessionKey } from './session';
import { toIngestCommand } from './inbound';
import { toWirePayload } from './wire';
import { createWebOutboundGateway } from './outbound-gateway';
import type { WebConnectionRegistry, WebRouteResolver } from './outbound-gateway';

const outboundMessage: Message = {
  id: 'msg_1',
  workspaceId: 'ws_1',
  conversationId: 'conv_1',
  channelId: 'chn_web',
  direction: 'outbound',
  sender: { kind: 'bot' },
  content: { type: 'text', text: 'ตอบกลับครับ' },
  status: 'sent',
  externalId: null,
  createdAt: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)),
};

describe('webSessionKey', () => {
  it('ประกอบคีย์จาก (workspace, channel, external) แบบ deterministic', () => {
    expect(webSessionKey('ws_1', 'chn_web', 'visitor-9')).toBe('ws_1:chn_web:visitor-9');
    // คนละ external = คนละคีย์ (แยก session ไม่ปนกัน)
    expect(webSessionKey('ws_1', 'chn_web', 'a')).not.toBe(webSessionKey('ws_1', 'chn_web', 'b'));
  });
});

describe('toIngestCommand', () => {
  it('map payload widget → unified command (sessionId→externalId, text→content)', () => {
    const cmd = toIngestCommand({
      workspaceId: 'ws_1',
      channelId: 'chn_web',
      sessionId: 'sess-abc',
      text: 'สวัสดี',
      contactName: 'ลูกค้า A',
    });
    expect(cmd).toEqual({
      workspaceId: 'ws_1',
      channelId: 'chn_web',
      externalId: 'sess-abc',
      content: { type: 'text', text: 'สวัสดี' },
      contactName: 'ลูกค้า A',
    });
  });

  it('ไม่ส่ง contactName → เป็น null', () => {
    const cmd = toIngestCommand({
      workspaceId: 'ws_1',
      channelId: 'chn_web',
      sessionId: 'sess-abc',
      text: 'hi',
    });
    expect(cmd.contactName).toBeNull();
  });
});

describe('toWirePayload', () => {
  it('serialize Message → wire event (createdAt → ISO string) + คงฟิลด์กลาง', () => {
    const wire = toWirePayload(outboundMessage);
    expect(wire).toEqual({
      type: 'message',
      messageId: 'msg_1',
      conversationId: 'conv_1',
      direction: 'outbound',
      content: { type: 'text', text: 'ตอบกลับครับ' },
      sender: { kind: 'bot' },
      at: '2026-01-02T03:04:05.000Z',
    });
    // JSON-safe จริง (ไม่มี Date object หลง)
    expect(() => JSON.stringify(wire)).not.toThrow();
  });
});

describe('createWebOutboundGateway', () => {
  it('resolve เจอ session + มี socket → push เข้า registry ด้วยคีย์ที่ถูก + delivered=true', async () => {
    const registry: WebConnectionRegistry = { send: vi.fn(() => 1) };
    const resolveRoute: WebRouteResolver = vi.fn(async () => 'visitor-9');
    const gateway = createWebOutboundGateway({ registry, resolveRoute });

    const res = await gateway.send(outboundMessage);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(true);
    expect(res.value.externalId).toBeNull();

    // ยิงเข้า registry ด้วยคีย์ session ที่ resolve ได้ + payload เป็น JSON ของ wire event
    expect(registry.send).toHaveBeenCalledOnce();
    const [key, data] = (registry.send as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(key).toBe('ws_1:chn_web:visitor-9');
    expect(JSON.parse(data)).toMatchObject({ type: 'message', messageId: 'msg_1' });
  });

  it('resolve ไม่เจอปลายทาง (null) → ไม่แตะ registry, delivered=false (ไม่ error)', async () => {
    const registry: WebConnectionRegistry = { send: vi.fn(() => 0) };
    const resolveRoute: WebRouteResolver = vi.fn(async () => null);
    const gateway = createWebOutboundGateway({ registry, resolveRoute });

    const res = await gateway.send(outboundMessage);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(false);
    expect(registry.send).not.toHaveBeenCalled();
  });

  it('resolve เจอ session แต่ไม่มี socket ต่ออยู่ (registry คืน 0) → delivered=false', async () => {
    const registry: WebConnectionRegistry = { send: vi.fn(() => 0) };
    const resolveRoute: WebRouteResolver = vi.fn(async () => 'visitor-9');
    const gateway = createWebOutboundGateway({ registry, resolveRoute });

    const res = await gateway.send(outboundMessage);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(false);
    expect(registry.send).toHaveBeenCalledOnce();
  });
});
