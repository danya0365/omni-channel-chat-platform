import { describe, expect, it } from 'vitest';
import type { Agent, AgentRepository } from '@omni/domain';
import { createAuthService } from './service';
import { hashPassword } from './password';

const SECRET = 'unit-test-secret-สิบหกตัวอักษร';

const demoAgent: Agent = {
  id: 'agt_1',
  workspaceId: 'ws_1',
  email: 'a@example.com',
  displayName: 'A',
  createdAt: new Date(Date.UTC(2026, 0, 1)),
};

/** AgentRepository ปลอม — คืน demoAgent + hash ที่กำหนด */
function makeAgents(hash: string): AgentRepository {
  return {
    findById: async (workspaceId, agentId) =>
      workspaceId === demoAgent.workspaceId && agentId === demoAgent.id ? demoAgent : null,
    findCredentialByEmail: async (email) =>
      email === demoAgent.email ? { agent: demoAgent, passwordHash: hash } : null,
  };
}

describe('AuthService', () => {
  it('login ถูก → token + agent · authenticate(token) คืน context จาก token', async () => {
    const auth = createAuthService({
      agents: makeAgents(await hashPassword('pw1234')),
      secret: SECRET,
      tokenTtlSec: 3600,
    });
    const res = await auth.login('a@example.com', 'pw1234');
    expect(res?.agent.id).toBe('agt_1');
    if (!res) return;
    expect(auth.authenticate(res.token)).toEqual({ workspaceId: 'ws_1', agentId: 'agt_1' });
  });

  it('รหัสผิด → null', async () => {
    const auth = createAuthService({
      agents: makeAgents(await hashPassword('correct')),
      secret: SECRET,
      tokenTtlSec: 3600,
    });
    expect(await auth.login('a@example.com', 'wrong')).toBeNull();
  });

  it('email ไม่มีในระบบ → null', async () => {
    const auth = createAuthService({ agents: makeAgents('x'), secret: SECRET, tokenTtlSec: 3600 });
    expect(await auth.login('nobody@example.com', 'x')).toBeNull();
  });

  it('authenticate token มั่ว → null', () => {
    const auth = createAuthService({ agents: makeAgents('x'), secret: SECRET, tokenTtlSec: 3600 });
    expect(auth.authenticate('garbage.token')).toBeNull();
  });
});
