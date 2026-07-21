import { z } from 'zod';
import { idSchema } from '../ids';
import type { Clock, IdGenerator } from '../ids';
import { err, ok } from '../result';
import type { Result } from '../result';
import { botRuleActionSchema, botRuleMatchTypeSchema } from '../schema/bot-rule';
import type { BotRule } from '../schema/bot-rule';
import type { WorkspaceBotConfig } from '../schema/workspace-bot-config';
import type {
  BotRulePatch,
  BotRuleRepository,
  ChannelRepository,
  WorkspaceBotConfigRepository,
} from '../ports';

export interface ManageBotRulesDeps {
  rules: BotRuleRepository;
  config: WorkspaceBotConfigRepository;
  /** ใช้ verify ว่า channel ที่ผูก rule เป็นของ workspace นี้จริง (กันผูกข้าม tenant) */
  channels: Pick<ChannelRepository, 'findPublicById'>;
  generateId: IdGenerator;
  now: Clock;
}

/** ค่าที่ตั้งได้ตอนสร้าง rule — id/createdAt ระบบออกให้ (client ตั้งเองไม่ได้) */
export const createBotRuleCommandSchema = z.object({
  workspaceId: idSchema('ws'),
  /** null = ใช้ทุกช่องทางใน workspace */
  channelId: idSchema('chn').nullable().default(null),
  matchType: botRuleMatchTypeSchema.default('contains'),
  pattern: z.string().trim().min(1).max(200),
  action: botRuleActionSchema,
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(100),
});
export type CreateBotRuleCommand = z.input<typeof createBotRuleCommandSchema>;

/** patch — ส่งเฉพาะ field ที่จะแก้ (ไม่ส่ง = ไม่แตะ) */
export const updateBotRuleCommandSchema = z.object({
  workspaceId: idSchema('ws'),
  ruleId: idSchema('botr'),
  channelId: idSchema('chn').nullable().optional(),
  matchType: botRuleMatchTypeSchema.optional(),
  pattern: z.string().trim().min(1).max(200).optional(),
  action: botRuleActionSchema.optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
});
export type UpdateBotRuleCommand = z.input<typeof updateBotRuleCommandSchema>;

export const botRuleRefSchema = z.object({
  workspaceId: idSchema('ws'),
  ruleId: idSchema('botr'),
});
export type BotRuleRef = z.infer<typeof botRuleRefSchema>;

export const setBotConfigCommandSchema = z.object({
  workspaceId: idSchema('ws'),
  botEnabled: z.boolean(),
  aiEnabled: z.boolean(),
});
export type SetBotConfigCommand = z.infer<typeof setBotConfigCommandSchema>;

export type ManageBotRulesError =
  | { code: 'invalid_command'; message: string }
  | { code: 'bot_rule_not_found'; message: string }
  | { code: 'channel_not_found'; message: string };

export interface ManageBotRules {
  list(workspaceId: BotRule['workspaceId']): Promise<BotRule[]>;
  create(input: CreateBotRuleCommand): Promise<Result<BotRule, ManageBotRulesError>>;
  update(input: UpdateBotRuleCommand): Promise<Result<BotRule, ManageBotRulesError>>;
  remove(input: BotRuleRef): Promise<Result<BotRuleRef, ManageBotRulesError>>;
  getConfig(workspaceId: BotRule['workspaceId']): Promise<WorkspaceBotConfig>;
  setConfig(input: SetBotConfigCommand): Promise<Result<WorkspaceBotConfig, ManageBotRulesError>>;
}

/**
 * manageBotRules — จอจัดการ bot ของ workspace (Phase 6): CRUD rules + สวิตช์ bot/AI
 *
 * ทุก op **scope workspace เสมอ** (id มาจาก token ไม่ใช่ body) · คืน `Result` ไม่ throw
 * ⚠️ ไม่เช็ค entitlement ที่นี่ — สิทธิ์เป็นเรื่องของ transport (route guard) ไม่ใช่ business rule ของ bot
 *    (ADR-0007: gate ที่ server จุดเดียวคือ route · service ถูกเรียกจาก consumer/route ที่ผ่าน gate มาแล้ว)
 */
export function createManageBotRules(deps: ManageBotRulesDeps): ManageBotRules {
  const { rules, config, channels, generateId, now } = deps;

  /** channel ที่ผูกต้องเป็นของ workspace นี้ (null = global → ผ่าน) — กันผูก rule ข้าม tenant */
  async function channelOk(
    workspaceId: BotRule['workspaceId'],
    channelId: BotRule['channelId'],
  ): Promise<boolean> {
    if (channelId === null) return true;
    const channel = await channels.findPublicById(channelId);
    return channel !== null && channel.workspaceId === workspaceId;
  }

  return {
    list: (workspaceId) => rules.listAll(workspaceId),

    create: async (input) => {
      const parsed = createBotRuleCommandSchema.safeParse(input);
      if (!parsed.success) return err({ code: 'invalid_command', message: parsed.error.message });
      const cmd = parsed.data;
      if (!(await channelOk(cmd.workspaceId, cmd.channelId))) {
        return err({ code: 'channel_not_found', message: 'channel not found in workspace' });
      }
      const rule: BotRule = {
        id: generateId('botr'),
        workspaceId: cmd.workspaceId,
        channelId: cmd.channelId,
        matchType: cmd.matchType,
        pattern: cmd.pattern,
        action: cmd.action,
        enabled: cmd.enabled,
        priority: cmd.priority,
        createdAt: now(),
      };
      await rules.insert(rule);
      return ok(rule);
    },

    update: async (input) => {
      const parsed = updateBotRuleCommandSchema.safeParse(input);
      if (!parsed.success) return err({ code: 'invalid_command', message: parsed.error.message });
      const { workspaceId, ruleId, ...patch } = parsed.data;
      if (patch.channelId !== undefined && !(await channelOk(workspaceId, patch.channelId))) {
        return err({ code: 'channel_not_found', message: 'channel not found in workspace' });
      }
      const updated = await rules.update(workspaceId, ruleId, patch as BotRulePatch);
      return updated
        ? ok(updated)
        : err({ code: 'bot_rule_not_found', message: 'bot rule not found in workspace' });
    },

    remove: async (input) => {
      const parsed = botRuleRefSchema.safeParse(input);
      if (!parsed.success) return err({ code: 'invalid_command', message: parsed.error.message });
      const removed = await rules.remove(parsed.data.workspaceId, parsed.data.ruleId);
      return removed
        ? ok(parsed.data)
        : err({ code: 'bot_rule_not_found', message: 'bot rule not found in workspace' });
    },

    /** ไม่มี row = ปิดทั้งคู่ (คง fail-closed ของ Phase 5 · จอ admin ไม่ต้องแยกเคส null) */
    getConfig: async (workspaceId) =>
      (await config.get(workspaceId)) ?? { workspaceId, botEnabled: false, aiEnabled: false },

    setConfig: async (input) => {
      const parsed = setBotConfigCommandSchema.safeParse(input);
      if (!parsed.success) return err({ code: 'invalid_command', message: parsed.error.message });
      return ok(await config.upsert(parsed.data));
    },
  };
}
