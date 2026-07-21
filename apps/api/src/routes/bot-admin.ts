import { z } from 'zod';
import { idSchema } from '@omni/domain';
import type { BotRule, ManageBotRules, ManageBotRulesError, Result } from '@omni/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppDeps } from '../deps';
import { requireEntitlement } from './entitlement-guard';

/** wire DTO ของ rule (Date → ISO) — UI ฝั่ง inbox นิยาม type ให้ตรง shape นี้ */
export interface WireBotRule {
  id: string;
  channelId: string | null;
  matchType: BotRule['matchType'];
  pattern: string;
  action: BotRule['action'];
  enabled: boolean;
  priority: number;
  createdAt: string;
}

export function toWireBotRule(r: BotRule): WireBotRule {
  return {
    id: r.id,
    channelId: r.channelId,
    matchType: r.matchType,
    pattern: r.pattern,
    action: r.action,
    enabled: r.enabled,
    priority: r.priority,
    createdAt: r.createdAt.toISOString(),
  };
}

/** body ของ create/update — workspaceId ไม่รับจาก client (มาจาก token) */
const actionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('reply'),
    content: z.object({ type: z.literal('text'), text: z.string().min(1).max(2000) }),
  }),
  z.object({ kind: z.literal('escalate') }),
]);

const createBodySchema = z.object({
  channelId: idSchema('chn').nullable().optional(),
  matchType: z.literal('contains').optional(),
  pattern: z.string().min(1).max(200),
  action: actionSchema,
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
});

const updateBodySchema = z.object({
  channelId: idSchema('chn').nullable().optional(),
  matchType: z.literal('contains').optional(),
  pattern: z.string().min(1).max(200).optional(),
  action: actionSchema.optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
});

const configBodySchema = z.object({ botEnabled: z.boolean(), aiEnabled: z.boolean() });

/** map domain error → HTTP status (not found = 404 · ที่เหลือ = 400) */
const statusOf = (error: ManageBotRulesError): number =>
  error.code === 'bot_rule_not_found' ? 404 : error.code === 'channel_not_found' ? 400 : 400;

function sendResult<T>(
  reply: FastifyReply,
  result: Result<T, ManageBotRulesError>,
  toBody: (value: T) => unknown,
): FastifyReply {
  return result.ok
    ? reply.send(toBody(result.value))
    : reply.code(statusOf(result.error)).send({ error: result.error.code });
}

/**
 * routes จอจัดการ bot (Phase 6) — **ทุก route ต้องซื้อโมดูล `bot`** (ADR-0007)
 *   GET    /inbox/bot/config           → สวิตช์ bot/AI ของ workspace
 *   PUT    /inbox/bot/config           → ตั้งสวิตช์
 *   GET    /inbox/bot/rules            → rules ทั้งหมด (รวมที่ปิด) เรียง priority
 *   POST   /inbox/bot/rules            → เพิ่ม rule
 *   PATCH  /inbox/bot/rules/:ruleId    → แก้ rule (ส่งเฉพาะ field ที่แก้)
 *   DELETE /inbox/bot/rules/:ruleId    → ลบ rule
 * ⚠️ workspaceId มาจาก token เสมอ — สิทธิ์ + tenant scope บังคับที่ server ไม่ใช่ที่ UI
 */
export function registerBotAdminRoutes(app: FastifyInstance, deps: AppDeps): void {
  const manage: ManageBotRules = deps.manageBotRules;
  const guard = (
    req: Parameters<typeof requireEntitlement>[0],
    reply: FastifyReply,
    write = false,
  ) => requireEntitlement(req, reply, deps, 'bot', { stateChanging: write });

  app.get('/inbox/bot/config', async (req, reply) => {
    const ctx = await guard(req, reply);
    if (!ctx) return reply;
    return reply.send({ config: await manage.getConfig(ctx.workspaceId) });
  });

  app.put('/inbox/bot/config', async (req, reply) => {
    const ctx = await guard(req, reply, true);
    if (!ctx) return reply;
    const body = configBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const result = await manage.setConfig({ workspaceId: ctx.workspaceId, ...body.data });
    return sendResult(reply, result, (config) => ({ config }));
  });

  app.get('/inbox/bot/rules', async (req, reply) => {
    const ctx = await guard(req, reply);
    if (!ctx) return reply;
    const rules = await manage.list(ctx.workspaceId);
    return reply.send({ rules: rules.map(toWireBotRule) });
  });

  app.post('/inbox/bot/rules', async (req, reply) => {
    const ctx = await guard(req, reply, true);
    if (!ctx) return reply;
    const body = createBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const result = await manage.create({ workspaceId: ctx.workspaceId, ...body.data });
    return sendResult(reply, result, (rule) => ({ rule: toWireBotRule(rule) }));
  });

  app.patch<{ Params: { ruleId: string } }>('/inbox/bot/rules/:ruleId', async (req, reply) => {
    const ctx = await guard(req, reply, true);
    if (!ctx) return reply;
    const ruleId = idSchema('botr').safeParse(req.params.ruleId);
    if (!ruleId.success) return reply.code(400).send({ error: 'invalid_rule_id' });
    const body = updateBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const result = await manage.update({
      workspaceId: ctx.workspaceId,
      ruleId: ruleId.data,
      ...body.data,
    });
    return sendResult(reply, result, (rule) => ({ rule: toWireBotRule(rule) }));
  });

  app.delete<{ Params: { ruleId: string } }>('/inbox/bot/rules/:ruleId', async (req, reply) => {
    const ctx = await guard(req, reply, true);
    if (!ctx) return reply;
    const ruleId = idSchema('botr').safeParse(req.params.ruleId);
    if (!ruleId.success) return reply.code(400).send({ error: 'invalid_rule_id' });
    const result = await manage.remove({ workspaceId: ctx.workspaceId, ruleId: ruleId.data });
    return sendResult(reply, result, ({ ruleId: id }) => ({ deleted: id }));
  });
}
