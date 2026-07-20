import type { LinePushClient, LinePushRequest, LinePushResult } from './outbound-gateway';

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

/** response subset ที่ client นี้ใช้ — Response ของ global fetch assignable กับ interface นี้ (structural) */
export interface LineHttpResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  /** อ่าน body เป็น JSON — profile API ใช้ (push ไม่ใช้) · optional เพื่อไม่บังคับ response ที่ไม่มี body */
  json?(): Promise<unknown>;
}

/** fetch subset ที่ client นี้ใช้ — inject เพื่อ test โดยไม่ยิง network จริง · body optional (GET เช่น profile ไม่มี) */
export type LineFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<LineHttpResponse>;

const defaultFetch: LineFetch = (url, init) => fetch(url, init);

/**
 * default LINE push client — POST /v2/bot/message/push ด้วย Bearer channelAccessToken
 *
 * non-2xx / network error → LinePushResult.ok=false (ไม่ throw) · MVP ไม่ retry/backoff (ADR-0004)
 * requestId = header `x-line-request-id` (LINE ไม่คืน message id ใน push response) — ไว้ trace
 * ⚠️ ไม่ log body/token (PII/secret — ดู AGENTS.md)
 */
export function createLineHttpPushClient(doFetch: LineFetch = defaultFetch): LinePushClient {
  return async (request: LinePushRequest): Promise<LinePushResult> => {
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        authorization: `Bearer ${request.accessToken}`,
      };
      // idempotency: LINE dedupe push ที่ retry-key ซ้ำภายใน 24 ชม. → retry ปลอดภัย (ไม่ double-send)
      if (request.retryKey) headers['x-line-retry-key'] = request.retryKey;
      const response = await doFetch(LINE_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: request.to, messages: request.messages }),
      });
      if (!response.ok) {
        return { ok: false, status: response.status, message: `line push HTTP ${response.status}` };
      }
      return { ok: true, requestId: response.headers.get('x-line-request-id') };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        message: error instanceof Error ? error.message : 'line push network error',
      };
    }
  };
}
