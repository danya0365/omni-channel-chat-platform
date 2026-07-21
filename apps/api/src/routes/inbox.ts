import { z } from 'zod';
import { idSchema } from '@omni/domain';
import type {
  AgentId,
  Conversation,
  ConversationId,
  ManageConversationError,
  Result,
  WorkspaceId,
} from '@omni/domain';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppDeps } from '../deps';
import { authFromRequest, authFromToken, isOriginAllowed } from '../auth/require-agent';
import { toWireConversation, toWireMessage } from './inbox-wire';

/** query paginate: limit (1-100, default 30) + before (cursor เป็น ISO date) */
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.coerce.date().optional(),
});
const replyBodySchema = z.object({ text: z.string().min(1) });

/**
 * routes ของ agent inbox (Phase 3) — ทุก route ต้อง auth (token → workspaceId/agentId)
 *   GET  /inbox/conversations                          → list ใน workspace ของ agent
 *   GET  /inbox/conversations/:conversationId/messages → history ของสาย (scope workspace)
 *   POST /inbox/conversations/:conversationId/reply    → agent ตอบ (sender = agent จริง)
 *   GET  /inbox/entitlements                            → โมดูลที่ workspace ซื้อไว้ (Phase 6)
 *   GET  /inbox/ws?token=...                            → WS realtime (register ตาม workspaceId)
 * ⚠️ workspaceId มาจาก token เท่านั้น (ไม่รับจาก client) — กัน cross-tenant
 */
export function registerInboxRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { auth, session, inboxRead, conversations, sendOutbound, agentRegistry } = deps;

  /**
   * สิทธิ์ของ workspace ตัวเอง — UI เอาไปซ่อนเมนูที่ไม่ได้ซื้อ (UX เท่านั้น ไม่ใช่ security · ADR-0007 ข้อ 4)
   * การบังคับสิทธิ์จริงอยู่ที่ route/service ของแต่ละโมดูล — ซ่อนเมนูแล้วยิง API ตรงต้องยังโดนปฏิเสธ
   * ไม่มี row = คืน `[]` (fail-closed) ไม่ใช่ 404 — client แยกไม่ออกว่า "ยังไม่ตั้งค่า" กับ "ไม่ได้ซื้อ" ก็ไม่ต่างกัน
   */
  app.get('/inbox/entitlements', async (req, reply) => {
    const ctx = authFromRequest(req, auth, session.cookieName);
    if (!ctx) return reply.code(401).send({ error: 'unauthorized' });
    const entitlements = await deps.entitlements.get(ctx.workspaceId);
    return reply.send({ modules: entitlements?.modules ?? [] });
  });

  app.get<{ Querystring: { limit?: string; before?: string } }>(
    '/inbox/conversations',
    async (req, reply) => {
      const ctx = authFromRequest(req, auth, session.cookieName);
      if (!ctx) return reply.code(401).send({ error: 'unauthorized' });
      const q = listQuerySchema.safeParse(req.query);
      if (!q.success) return reply.code(400).send({ error: 'invalid_query' });

      const items = await inboxRead.listConversations(ctx.workspaceId, {
        limit: q.data.limit,
        before: q.data.before,
      });
      return reply.send({ conversations: items.map(toWireConversation) });
    },
  );

  app.get<{ Params: { conversationId: string }; Querystring: { limit?: string; before?: string } }>(
    '/inbox/conversations/:conversationId/messages',
    async (req, reply) => {
      const ctx = authFromRequest(req, auth, session.cookieName);
      if (!ctx) return reply.code(401).send({ error: 'unauthorized' });
      const convId = idSchema('conv').safeParse(req.params.conversationId);
      if (!convId.success) return reply.code(400).send({ error: 'invalid_conversation_id' });
      const q = listQuerySchema.safeParse(req.query);
      if (!q.success) return reply.code(400).send({ error: 'invalid_query' });

      const msgs = await inboxRead.listMessages(ctx.workspaceId, convId.data, {
        limit: q.data.limit,
        before: q.data.before,
      });
      return reply.send({ messages: msgs.map(toWireMessage) });
    },
  );

  app.post<{ Params: { conversationId: string } }>(
    '/inbox/conversations/:conversationId/reply',
    async (req, reply) => {
      const ctx = authFromRequest(req, auth, session.cookieName);
      if (!ctx) return reply.code(401).send({ error: 'unauthorized' });
      // CSRF: cookie auto-send + POST → เช็ค Origin (defense-in-depth ร่วมกับ SameSite=Strict)
      if (!isOriginAllowed(req, session.allowedOrigins)) {
        return reply.code(403).send({ error: 'forbidden_origin' });
      }
      const convId = idSchema('conv').safeParse(req.params.conversationId);
      if (!convId.success) return reply.code(400).send({ error: 'invalid_conversation_id' });
      const body = replyBodySchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

      // resolve conversation (scope workspace) → รู้ channel ของสาย + กันตอบข้าม tenant
      const conversation = await conversations.findById(ctx.workspaceId, convId.data);
      if (!conversation) return reply.code(404).send({ error: 'conversation_not_found' });

      const result = await sendOutbound({
        workspaceId: ctx.workspaceId,
        channelId: conversation.channelId,
        conversationId: convId.data,
        content: { type: 'text', text: body.data.text },
        sender: { kind: 'agent', agentId: ctx.agentId },
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
        message: toWireMessage(result.value.message),
        delivered: result.value.delivered,
      });
    },
  );

  // routing/assignment (Phase 4) แยกเป็นกลุ่มของตัวเอง — กัน register function บวมเป็น God function
  registerManageRoutes(app, deps);

  app.get<{ Querystring: { token?: string } }>('/inbox/ws', { websocket: true }, (socket, req) => {
    // cookie มากับ WS handshake (same-site) → auth ผ่าน cookie · ?token= = fallback ระหว่าง migrate
    const ctx =
      authFromRequest(req, auth, session.cookieName) ?? authFromToken(req.query.token, auth);
    if (!ctx) {
      socket.close(1008, 'unauthorized');
      return;
    }
    // register ใต้ workspaceId — consumer (pg-boss) จะ fan-out event ของ workspace นี้มาที่ key เดียวกัน
    agentRegistry.add(ctx.workspaceId, socket);
    socket.on('close', () => agentRegistry.remove(ctx.workspaceId, socket));
  });
}

/**
 * routing/assignment routes (Phase 4) — assign / unassign / close / reopen
 * auth → validate → เรียก service → คืน patch (id/status/assignee) ให้ UI merge · event realtime sync agent อื่น
 */
function registerManageRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { auth, session, manageConversation } = deps;

  const handleManage = async (
    req: FastifyRequest<{ Params: { conversationId: string } }>,
    reply: FastifyReply,
    run: (
      workspaceId: WorkspaceId,
      conversationId: ConversationId,
      agentId: AgentId,
    ) => Promise<Result<Conversation, ManageConversationError>>,
  ): Promise<FastifyReply> => {
    const ctx = authFromRequest(req, auth, session.cookieName);
    if (!ctx) return reply.code(401).send({ error: 'unauthorized' });
    if (!isOriginAllowed(req, session.allowedOrigins)) {
      return reply.code(403).send({ error: 'forbidden_origin' });
    }
    const convId = idSchema('conv').safeParse(req.params.conversationId);
    if (!convId.success) return reply.code(400).send({ error: 'invalid_conversation_id' });

    const result = await run(ctx.workspaceId, convId.data, ctx.agentId);
    if (!result.ok) {
      return reply
        .code(result.error.code === 'conversation_not_found' ? 404 : 400)
        .send({ error: result.error.code });
    }
    const c = result.value;
    return reply.send({ conversation: { id: c.id, status: c.status, assignee: c.assignee } });
  };

  app.post<{ Params: { conversationId: string } }>(
    '/inbox/conversations/:conversationId/assign',
    (req, reply) =>
      handleManage(req, reply, (workspaceId, conversationId, agentId) =>
        manageConversation.assign({ workspaceId, conversationId, agentId }),
      ),
  );
  app.post<{ Params: { conversationId: string } }>(
    '/inbox/conversations/:conversationId/unassign',
    (req, reply) =>
      handleManage(req, reply, (workspaceId, conversationId) =>
        manageConversation.unassign({ workspaceId, conversationId }),
      ),
  );
  app.post<{ Params: { conversationId: string } }>(
    '/inbox/conversations/:conversationId/close',
    (req, reply) =>
      handleManage(req, reply, (workspaceId, conversationId) =>
        manageConversation.close({ workspaceId, conversationId }),
      ),
  );
  app.post<{ Params: { conversationId: string } }>(
    '/inbox/conversations/:conversationId/reopen',
    (req, reply) =>
      handleManage(req, reply, (workspaceId, conversationId) =>
        manageConversation.reopen({ workspaceId, conversationId }),
      ),
  );
}
