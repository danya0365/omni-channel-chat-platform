import { describe, expect, it, vi } from 'vitest';
import { ok } from '@omni/domain';
import type { Message, OutboundGateway } from '@omni/domain';
import { createDispatchOutboundGateway } from './outbound-dispatch';

const message: Message = {
  id: 'msg_1',
  workspaceId: 'ws_1',
  conversationId: 'conv_1',
  channelId: 'chn_1',
  direction: 'outbound',
  sender: { kind: 'agent', agentId: 'agt_1' },
  content: { type: 'text', text: 'ตอบกลับ' },
  status: 'sent',
  externalId: null,
  createdAt: new Date(Date.UTC(2026, 0, 1)),
};

/** gateway ปลอมที่ tag externalId ด้วย label เพื่อรู้ว่าตัวไหนถูกเรียก */
function tagGateway(label: string): OutboundGateway {
  return { send: vi.fn(async () => ok({ externalId: label, delivered: true })) };
}

describe('createDispatchOutboundGateway', () => {
  it('channel type = web → เรียก web gateway (line ไม่ถูกแตะ)', async () => {
    const web = tagGateway('web');
    const line = tagGateway('line');
    const dispatch = createDispatchOutboundGateway({
      resolveChannelType: async () => 'web',
      byType: { web, line },
    });

    const res = await dispatch.send(message);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.externalId).toBe('web');
    expect(web.send).toHaveBeenCalledOnce();
    expect(line.send).not.toHaveBeenCalled();
  });

  it('channel type = line → เรียก line gateway (web ไม่ถูกแตะ)', async () => {
    const web = tagGateway('web');
    const line = tagGateway('line');
    const dispatch = createDispatchOutboundGateway({
      resolveChannelType: async () => 'line',
      byType: { web, line },
    });

    const res = await dispatch.send(message);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.externalId).toBe('line');
    expect(line.send).toHaveBeenCalledOnce();
    expect(web.send).not.toHaveBeenCalled();
  });

  it('resolve channel type ไม่ได้ (null) → delivered:false, ไม่เรียก gateway ไหนเลย', async () => {
    const web = tagGateway('web');
    const line = tagGateway('line');
    const dispatch = createDispatchOutboundGateway({
      resolveChannelType: async () => null,
      byType: { web, line },
    });

    const res = await dispatch.send(message);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.delivered).toBe(false);
    expect(web.send).not.toHaveBeenCalled();
    expect(line.send).not.toHaveBeenCalled();
  });
});
