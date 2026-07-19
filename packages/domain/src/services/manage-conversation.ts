import { z } from 'zod';
import { idSchema } from '../ids';
import type { Clock } from '../ids';
import { err, ok } from '../result';
import type { Result } from '../result';
import type { Assignee, Conversation, ConversationStatus } from '../schema/conversation';
import type { ConversationRepository, EventBus } from '../ports';

/** deps ที่ service ต้องใช้ — wire ที่ composition root (apps/api) */
export interface ManageConversationDeps {
  conversations: ConversationRepository;
  events: EventBus;
  now: Clock;
}

export const assignCommandSchema = z.object({
  workspaceId: idSchema('ws'),
  conversationId: idSchema('conv'),
  agentId: idSchema('agt'),
});
export type AssignCommand = z.infer<typeof assignCommandSchema>;

export const conversationRefSchema = z.object({
  workspaceId: idSchema('ws'),
  conversationId: idSchema('conv'),
});
export type ConversationRef = z.infer<typeof conversationRefSchema>;

export type ManageConversationError =
  | { code: 'invalid_command'; message: string }
  | { code: 'conversation_not_found'; message: string };

export interface ManageConversation {
  assign(input: AssignCommand): Promise<Result<Conversation, ManageConversationError>>;
  unassign(input: ConversationRef): Promise<Result<Conversation, ManageConversationError>>;
  close(input: ConversationRef): Promise<Result<Conversation, ManageConversationError>>;
  reopen(input: ConversationRef): Promise<Result<Conversation, ManageConversationError>>;
}

/**
 * manageConversation — routing/assignment ของ agent inbox (Phase 4)
 *   assign/unassign (ตั้ง/ถอดผู้รับผิดชอบ) · close/reopen (สถานะสาย)
 * ทุก op: หา conversation (scope workspace) → อัปเดต repo → publish `conversation.updated` (agent อื่น sync realtime)
 * คืน Result — conversation ไม่มี = err (ไม่ใช่ exceptional)
 */
export function createManageConversation(deps: ManageConversationDeps): ManageConversation {
  const { conversations, events, now } = deps;

  /** โหลด conversation (scope workspace) → apply mutation → publish event → คืน conversation ใหม่ */
  async function mutate(
    workspaceId: Conversation['workspaceId'],
    conversationId: Conversation['id'],
    apply: (conversation: Conversation) => Promise<Conversation>,
  ): Promise<Result<Conversation, ManageConversationError>> {
    const conversation = await conversations.findById(workspaceId, conversationId);
    if (!conversation) {
      return err({
        code: 'conversation_not_found',
        message: 'conversation not found in workspace',
      });
    }
    const updated = await apply(conversation);
    await events.publish({
      type: 'conversation.updated',
      workspaceId,
      conversationId,
      occurredAt: now(),
    });
    return ok(updated);
  }

  async function setAssignee(
    workspaceId: Conversation['workspaceId'],
    conversationId: Conversation['id'],
    assignee: Assignee | null,
  ): Promise<Result<Conversation, ManageConversationError>> {
    return mutate(workspaceId, conversationId, async (conversation) => {
      await conversations.setAssignee(workspaceId, conversationId, assignee);
      return { ...conversation, assignee };
    });
  }

  async function setStatus(
    workspaceId: Conversation['workspaceId'],
    conversationId: Conversation['id'],
    status: ConversationStatus,
  ): Promise<Result<Conversation, ManageConversationError>> {
    return mutate(workspaceId, conversationId, async (conversation) => {
      await conversations.setStatus(workspaceId, conversationId, status);
      return { ...conversation, status };
    });
  }

  return {
    assign: async (input) => {
      const parsed = assignCommandSchema.safeParse(input);
      if (!parsed.success) return err({ code: 'invalid_command', message: parsed.error.message });
      return setAssignee(parsed.data.workspaceId, parsed.data.conversationId, {
        kind: 'agent',
        agentId: parsed.data.agentId,
      });
    },
    unassign: async (input) => {
      const parsed = conversationRefSchema.safeParse(input);
      if (!parsed.success) return err({ code: 'invalid_command', message: parsed.error.message });
      return setAssignee(parsed.data.workspaceId, parsed.data.conversationId, null);
    },
    close: async (input) => {
      const parsed = conversationRefSchema.safeParse(input);
      if (!parsed.success) return err({ code: 'invalid_command', message: parsed.error.message });
      return setStatus(parsed.data.workspaceId, parsed.data.conversationId, 'closed');
    },
    reopen: async (input) => {
      const parsed = conversationRefSchema.safeParse(input);
      if (!parsed.success) return err({ code: 'invalid_command', message: parsed.error.message });
      return setStatus(parsed.data.workspaceId, parsed.data.conversationId, 'open');
    },
  };
}
