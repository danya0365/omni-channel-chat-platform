import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from './session-token';

const SECRET = 'test-secret-อย่างน้อยสิบหกตัวอักษร';

describe('session token (HMAC)', () => {
  it('sign แล้ว verify → คืน claims (ฝัง exp = now + ttl)', () => {
    const token = signSession({ workspaceId: 'ws_1', agentId: 'agt_1' }, SECRET, 3600, 1000);
    expect(verifySession(token, SECRET, 1000)).toMatchObject({
      workspaceId: 'ws_1',
      agentId: 'agt_1',
      exp: 4600,
    });
  });

  it('secret ผิด → null', () => {
    const token = signSession({ workspaceId: 'ws_1', agentId: 'agt_1' }, SECRET, 3600, 1000);
    expect(verifySession(token, 'secret-อื่น-สิบหกตัว', 1000)).toBeNull();
  });

  it('token หมดอายุ (now > exp) → null', () => {
    const token = signSession({ workspaceId: 'ws_1', agentId: 'agt_1' }, SECRET, 3600, 1000);
    expect(verifySession(token, SECRET, 5000)).toBeNull();
  });

  it('payload ถูก tamper (sig เดิม) → null', () => {
    const token = signSession({ workspaceId: 'ws_1', agentId: 'agt_1' }, SECRET, 3600, 1000);
    const sig = token.split('.')[1];
    const evil = Buffer.from(
      JSON.stringify({ workspaceId: 'ws_evil', agentId: 'agt_1', exp: 4600 }),
    ).toString('base64url');
    expect(verifySession(`${evil}.${sig}`, SECRET, 1000)).toBeNull();
  });

  it('รูปแบบผิด (ไม่มีจุดคั่น) → null', () => {
    expect(verifySession('abc', SECRET, 1000)).toBeNull();
  });
});
