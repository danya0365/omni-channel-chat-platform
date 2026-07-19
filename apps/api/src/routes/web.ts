import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idSchema } from '@omni/domain';
import type { Channel } from '@omni/domain';
import { CHANNEL_WEB_TYPE, toIngestCommand, webSessionKey } from '@omni/channel-web';
import type { AppDeps } from '../deps';

/** body ของ POST messages (inbound จาก widget) */
const inboundBodySchema = z.object({
  sessionId: z.string().min(1),
  text: z.string().min(1),
  contactName: z.string().min(1).nullish(),
});

/** body ของ POST reply (agent/bot ตอบกลับ — Phase 2 demo, Phase 3 จะมี auth + agentId จริง) */
const replyBodySchema = z.object({
  conversationId: idSchema('conv'),
  text: z.string().min(1),
});

/** query ของ WS connect */
const wsQuerySchema = z.object({ sessionId: z.string().min(1) });

/**
 * routes ของ web channel — จุดเชื่อม widget ↔ core
 *   POST /channels/web/:channelId/sessions   → mint sessionId (ยังไม่ persist — contact เกิดตอนส่งข้อความแรก)
 *   POST /channels/web/:channelId/messages   → inbound: map → ingestInboundMessage
 *   GET  /channels/web/:channelId/ws          → WS: register socket ตาม session (รับ outbound realtime)
 *   POST /channels/web/:channelId/reply       → outbound: sendOutboundMessage (demo agent/bot)
 *
 * channelId เป็น public identifier ใน URL · resolveWebChannel สถาปนา workspace context จาก channelId
 */
export function registerWebRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { channels, ingest, sendOutbound, registry, newSessionId } = deps;

  /** resolve channelId (public) → web channel · null ถ้า id ผิดรูป/ไม่มี/ไม่ใช่ web */
  async function resolveWebChannel(rawChannelId: string): Promise<Channel | null> {
    const parsed = idSchema('chn').safeParse(rawChannelId);
    if (!parsed.success) return null;
    const channel = await channels.findPublicById(parsed.data);
    if (!channel || channel.type !== CHANNEL_WEB_TYPE) return null;
    return channel;
  }

  app.post<{ Params: { channelId: string } }>(
    '/channels/web/:channelId/sessions',
    async (req, reply) => {
      const channel = await resolveWebChannel(req.params.channelId);
      if (!channel) return reply.code(404).send({ error: 'channel_not_found' });
      // sessionId = token สุ่ม (จะกลายเป็น externalId ของ identity ตอนส่งข้อความแรก)
      return reply.send({ sessionId: newSessionId(), channelId: channel.id });
    },
  );

  app.post<{ Params: { channelId: string } }>(
    '/channels/web/:channelId/messages',
    async (req, reply) => {
      const channel = await resolveWebChannel(req.params.channelId);
      if (!channel) return reply.code(404).send({ error: 'channel_not_found' });

      const body = inboundBodySchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

      const result = await ingest(
        toIngestCommand({
          workspaceId: channel.workspaceId,
          channelId: channel.id,
          sessionId: body.data.sessionId,
          text: body.data.text,
          contactName: body.data.contactName,
        }),
      );
      if (!result.ok) return reply.code(400).send({ error: result.error.code });

      return reply.send({
        conversationId: result.value.conversation.id,
        messageId: result.value.message.id,
        at: result.value.message.createdAt.toISOString(),
      });
    },
  );

  app.get<{ Params: { channelId: string }; Querystring: { sessionId?: string } }>(
    '/channels/web/:channelId/ws',
    { websocket: true },
    async (socket, req) => {
      const channel = await resolveWebChannel(req.params.channelId);
      const query = wsQuerySchema.safeParse(req.query);
      if (!channel || !query.success) {
        socket.close(1008, 'invalid_channel_or_session');
        return;
      }
      // register socket ใต้ key ของ session นี้ (identity บนช่องทาง) — outbound gateway จะ push มาที่ key เดียวกัน
      const key = webSessionKey(channel.workspaceId, channel.id, query.data.sessionId);
      registry.add(key, socket);
      socket.on('close', () => registry.remove(key, socket));
    },
  );

  app.post<{ Params: { channelId: string } }>(
    '/channels/web/:channelId/reply',
    async (req, reply) => {
      const channel = await resolveWebChannel(req.params.channelId);
      if (!channel) return reply.code(404).send({ error: 'channel_not_found' });

      const body = replyBodySchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

      const result = await sendOutbound({
        workspaceId: channel.workspaceId,
        channelId: channel.id,
        conversationId: body.data.conversationId,
        content: { type: 'text', text: body.data.text },
      });
      if (!result.ok) {
        const status =
          result.error.code === 'conversation_not_found'
            ? 404
            : result.error.code === 'send_failed'
              ? 502
              : 400;
        return reply.code(status).send({ error: result.error.code });
      }

      return reply.send({
        messageId: result.value.message.id,
        delivered: result.value.delivered,
      });
    },
  );
}
