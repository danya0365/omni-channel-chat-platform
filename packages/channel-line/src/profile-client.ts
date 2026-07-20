import type { ChannelId, WorkspaceId } from '@omni/domain';
import type { LineCredentialResolver } from './credentials';
import type { LineFetch } from './push-client';

const LINE_PROFILE_URL = 'https://api.line.me/v2/bot/profile';

const defaultFetch: LineFetch = (url, init) => fetch(url, init);

export type LineProfileResult = { ok: true; displayName: string } | { ok: false };

/** client เรียก LINE profile API — inject fetch เพื่อ test ได้ (เหมือน push-client) */
export type LineProfileClient = (accessToken: string, userId: string) => Promise<LineProfileResult>;

/**
 * default LINE profile client — GET /v2/bot/profile/{userId} ด้วย Bearer channelAccessToken
 * non-2xx / ไม่มี displayName / network error → ok:false (ไม่ throw — ชื่อเป็น best-effort) · ⚠️ ไม่ log token/PII
 */
export function createLineHttpProfileClient(doFetch: LineFetch = defaultFetch): LineProfileClient {
  return async (accessToken, userId) => {
    try {
      const response = await doFetch(`${LINE_PROFILE_URL}/${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok || !response.json) return { ok: false };
      const data = (await response.json()) as { displayName?: unknown };
      if (typeof data.displayName !== 'string' || data.displayName.length === 0) {
        return { ok: false };
      }
      return { ok: true, displayName: data.displayName };
    } catch {
      return { ok: false };
    }
  };
}

/**
 * LineProfileResolver — (workspace, channel, userId) → display name | null
 * bridge credential resolver + profile client ที่ composition root (db คืน token, adapter เรียก LINE)
 */
export type LineProfileResolver = (
  workspaceId: WorkspaceId,
  channelId: ChannelId,
  userId: string,
) => Promise<string | null>;

export interface LineProfileResolverDeps {
  resolveCredentials: LineCredentialResolver;
  client: LineProfileClient;
}

/** ประกอบ resolver — ไม่มี credential / profile ล้ม → null (contact ไม่มีชื่อก็ไม่เป็นไร best-effort) */
export function createLineProfileResolver(deps: LineProfileResolverDeps): LineProfileResolver {
  const { resolveCredentials, client } = deps;
  return async (workspaceId, channelId, userId) => {
    const credentials = await resolveCredentials(workspaceId, channelId);
    if (!credentials) return null;
    const result = await client(credentials.channelAccessToken, userId);
    return result.ok ? result.displayName : null;
  };
}
