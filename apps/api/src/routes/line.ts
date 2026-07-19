import type { FastifyInstance } from 'fastify';
import { idSchema } from '@omni/domain';
import type { Channel } from '@omni/domain';
import { CHANNEL_LINE_TYPE, toIngestCommands, verifyLineSignature } from '@omni/channel-line';
import type { AppDeps } from '../deps';

/**
 * LINE channel routes — จุดเชื่อม LINE Messaging API ↔ core
 *   POST /channels/line/:channelId/webhook → inbound: verify x-line-signature → map event → ingest
 *
 * ⚠️ signature verify ต้องใช้ **raw body** (byte ก่อน parse JSON) → register ใน plugin ย่อยที่มี
 * content-type parser ของตัวเอง (parseAs buffer) — **encapsulated** ไม่กระทบ JSON parser ของ route อื่น
 * ⚠️ verify จริงกับ LINE bot ไม่ได้ในนี้ (ไม่มี public URL/bot) → พิสูจน์ด้วย contract test + fixture เท่านั้น
 */
export function registerLineRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { channels, ingest, lineCredentials } = deps;

  app.register(async (line) => {
    // เก็บ raw body เป็น Buffer (ไม่ parse JSON ที่นี่) — handler verify HMAC กับ raw ก่อน แล้วค่อย parse เอง
    line.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body);
    });

    /** resolve channelId (public) → line channel · null ถ้า id ผิดรูป/ไม่มี/ไม่ใช่ line */
    async function resolveLineChannel(rawChannelId: string): Promise<Channel | null> {
      const parsed = idSchema('chn').safeParse(rawChannelId);
      if (!parsed.success) return null;
      const channel = await channels.findPublicById(parsed.data);
      if (!channel || channel.type !== CHANNEL_LINE_TYPE) return null;
      return channel;
    }

    line.post<{ Params: { channelId: string } }>(
      '/channels/line/:channelId/webhook',
      async (req, reply) => {
        const channel = await resolveLineChannel(req.params.channelId);
        if (!channel) return reply.code(404).send({ error: 'channel_not_found' });

        // ต้องมี credential (channel secret) ก่อน ไม่งั้น verify signature ไม่ได้
        const credentials = await lineCredentials(channel.workspaceId, channel.id);
        if (!credentials) return reply.code(401).send({ error: 'channel_not_configured' });

        const rawBody = req.body as Buffer;
        const header = req.headers['x-line-signature'];
        const signature = Array.isArray(header) ? header[0] : header;
        if (!verifyLineSignature(rawBody, signature, credentials.channelSecret)) {
          return reply.code(401).send({ error: 'invalid_signature' });
        }

        // parse หลัง verify ผ่านแล้ว → map เป็น ingest commands (เฉพาะ text message จาก user)
        let body: unknown;
        try {
          body = rawBody.length > 0 ? JSON.parse(rawBody.toString('utf8')) : {};
        } catch {
          return reply.code(400).send({ error: 'invalid_json' });
        }

        const commands = toIngestCommands(body, {
          workspaceId: channel.workspaceId,
          channelId: channel.id,
        });
        // ingest ทีละ event · best-effort (fail 1 ไม่ล้มทั้ง batch) — LINE ต้องได้ 200 เร็ว ไม่งั้น retry รัว
        for (const command of commands) {
          const result = await ingest(command);
          if (!result.ok) {
            // log แค่ code (ไม่มี PII/ข้อความ) — ดู AGENTS.md
            console.warn('line ingest command failed:', result.error.code);
          }
        }
        return reply.send({ ok: true });
      },
    );
  });
}
