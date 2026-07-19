import { describe, expect, it } from 'vitest';
import { agentSchema } from './agent';

const validAgent = {
  id: 'agt_1',
  workspaceId: 'ws_1',
  email: 'agent@example.com',
  displayName: 'ทีมงาน A',
  createdAt: new Date(Date.UTC(2026, 0, 1)),
};

describe('agentSchema', () => {
  it('ผ่านเมื่อ shape ครบถูกต้อง', () => {
    const parsed = agentSchema.parse(validAgent);
    expect(parsed.email).toBe('agent@example.com');
    expect(parsed.workspaceId).toBe('ws_1');
  });

  it('email ไม่ใช่รูปอีเมล → fail', () => {
    expect(agentSchema.safeParse({ ...validAgent, email: 'ไม่ใช่อีเมล' }).success).toBe(false);
  });

  it('displayName ว่าง → fail', () => {
    expect(agentSchema.safeParse({ ...validAgent, displayName: '' }).success).toBe(false);
  });

  it('id ผิด prefix (ไม่ใช่ agt_) → fail', () => {
    expect(agentSchema.safeParse({ ...validAgent, id: 'ws_1' }).success).toBe(false);
  });
});
