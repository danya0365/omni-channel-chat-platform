import type { Agent, AgentId, AgentRepository, WorkspaceId } from '@omni/domain';
import { verifyPassword } from './password';
import { signSession, verifySession } from './session-token';

/** ตัวตนที่ผ่าน auth แล้ว — inject เข้า route/WS จาก token (ไม่รับ workspaceId จาก client) */
export interface AuthContext {
  workspaceId: WorkspaceId;
  agentId: AgentId;
}

export interface LoginResult {
  token: string;
  agent: Agent;
}

export interface AuthService {
  /** verify email+password → ออก token · null ถ้า credential ผิด */
  login(email: string, password: string): Promise<LoginResult | null>;
  /** verify token → AuthContext · null ถ้า token ไม่ผ่าน */
  authenticate(token: string): AuthContext | null;
}

export interface AuthServiceConfig {
  agents: AgentRepository;
  /** secret สำหรับ sign token — มาจาก env (AUTH_SESSION_SECRET) */
  secret: string;
  /** อายุ token (วินาที) */
  tokenTtlSec: number;
}

/**
 * AuthService (minimal signed-session) — ประกอบ AgentRepository + password verify + session token
 * login ไม่รู้ workspace ล่วงหน้า: resolve จาก email แล้วฝัง workspaceId ลง token (ดู AgentRepository)
 */
export function createAuthService({ agents, secret, tokenTtlSec }: AuthServiceConfig): AuthService {
  return {
    login: async (email, password) => {
      const cred = await agents.findCredentialByEmail(email);
      if (!cred) return null;
      const okPassword = await verifyPassword(password, cred.passwordHash);
      if (!okPassword) return null;
      const token = signSession(
        { workspaceId: cred.agent.workspaceId, agentId: cred.agent.id },
        secret,
        tokenTtlSec,
      );
      return { token, agent: cred.agent };
    },

    authenticate: (token) => {
      const claims = verifySession(token, secret);
      if (!claims) return null;
      // claims มาจาก token ที่เรา sign เอง (ผ่าน branded id) — คืน brand กลับ
      return {
        workspaceId: claims.workspaceId as WorkspaceId,
        agentId: claims.agentId as AgentId,
      };
    },
  };
}
