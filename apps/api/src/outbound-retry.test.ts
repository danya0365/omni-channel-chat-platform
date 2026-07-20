import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '@omni/domain';
import type { Message, OutboundGateway } from '@omni/domain';
import { createRetryingOutboundGateway } from './outbound-retry';

const message: Message = {
  id: 'msg_1',
  workspaceId: 'ws_1',
  conversationId: 'conv_1',
  channelId: 'chn_line',
  direction: 'outbound',
  sender: { kind: 'bot' },
  content: { type: 'text', text: 'hi' },
  status: 'sent',
  externalId: null,
  createdAt: new Date(Date.UTC(2026, 0, 1)),
};

/** gateway ที่ล้ม `failCount` ครั้งแรกแล้วค่อยสำเร็จ · นับจำนวนครั้งที่ถูกเรียก */
function failingThenOk(failCount: number): { gateway: OutboundGateway; calls: () => number } {
  let n = 0;
  return {
    gateway: {
      send: async () => {
        n += 1;
        if (n <= failCount) return err({ code: 'send_failed', message: `fail ${n}` });
        return ok({ externalId: 'req', delivered: true });
      },
    },
    calls: () => n,
  };
}

describe('createRetryingOutboundGateway', () => {
  it('สำเร็จครั้งแรก → ไม่ retry, ไม่ sleep', async () => {
    const { gateway, calls } = failingThenOk(0);
    const sleep = vi.fn(async () => {});
    const wrapped = createRetryingOutboundGateway(gateway, {
      attempts: 3,
      backoffMs: [10, 20],
      sleep,
    });

    const res = await wrapped.send(message);
    expect(res.ok).toBe(true);
    expect(calls()).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('ล้มครั้งแรกแล้วสำเร็จ → retry จนผ่าน (2 ครั้ง, sleep 1 ครั้งด้วย backoff แรก)', async () => {
    const { gateway, calls } = failingThenOk(1);
    const sleep = vi.fn(async () => {});
    const wrapped = createRetryingOutboundGateway(gateway, {
      attempts: 3,
      backoffMs: [10, 20],
      sleep,
    });

    const res = await wrapped.send(message);
    expect(res.ok).toBe(true);
    expect(calls()).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
  });

  it('ล้มทุกครั้ง → คืน error ตัวสุดท้าย, ยิงครบ attempts, sleep = attempts-1', async () => {
    const { gateway, calls } = failingThenOk(99);
    const sleep = vi.fn(async () => {});
    const wrapped = createRetryingOutboundGateway(gateway, {
      attempts: 3,
      backoffMs: [10, 20],
      sleep,
    });

    const res = await wrapped.send(message);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('send_failed');
    expect(calls()).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(2, 20); // backoff ตัวที่สอง
  });

  it('gateway คืน ok เสมอ (web offline = delivered:false) → ไม่ retry (ok ไม่ใช่ failure)', async () => {
    const send = vi.fn(async () => ok({ externalId: null, delivered: false }));
    const sleep = vi.fn(async () => {});
    const wrapped = createRetryingOutboundGateway(
      { send },
      { attempts: 3, backoffMs: [10], sleep },
    );

    const res = await wrapped.send(message);
    expect(res.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
