import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';

import type { OperationDef } from '../operation.types';
import { AGENT_TOKEN_TTL_MS } from '../ops-agents.service';

/**
 * OPS Part 4 — agent lifecycle as OPERATIONS (SENSITIVE tier, permission
 * agents.manage — held by OWNER only via the wildcard). The service token
 * is returned ONCE to the caller and never stored in the execution ledger
 * (redactResult), same posture as users.pii.unmask.
 *
 * Least privilege is structural: an agent can never hold OWNER (refused as
 * a precondition), and no role can let it execute money — the registry
 * refuses AGENT+MONEY before permissions are consulted.
 */

function mintToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = `wagent_${randomBytes(32).toString('hex')}`;
  return {
    raw,
    hash: createHash('sha256').update(raw).digest('hex'),
    expiresAt: new Date(Date.now() + AGENT_TOKEN_TTL_MS),
  };
}

const createInput = z.object({
  nameAr: z.string().min(3).max(80),
  roleKey: z.string().min(2).max(40),
});

const agentCreate: OperationDef<
  z.infer<typeof createInput>,
  { agentId: string; token: string; tokenExpiresAt: string }
> = {
  key: 'agents.create',
  titleAr: 'إنشاء وكيل',
  descriptionAr:
    'إنشاء حساب وكيل ذكاء اصطناعي بدور من مصفوفة الأدوار (OWNER ممنوع بنيوياً). يُعرض رمز الخدمة مرة واحدة فقط ولا يُخزَّن في سجل التنفيذ.',
  inputSchema: createInput,
  permission: 'agents.manage',
  riskTier: 'SENSITIVE',
  reversible: true,
  compensatingKey: 'agents.set-active',
  requiresReason: true,
  preconditions: [
    {
      code: 'role-missing',
      reasonAr: 'الدور غير موجود في مصفوفة الأدوار',
      check: async (db, input) =>
        !!(await db.opsRole.findUnique({ where: { key: input.roleKey }, select: { id: true } })),
    },
    {
      code: 'owner-forbidden',
      reasonAr: 'الوكيل لا يحمل دور OWNER أبداً — مبدأ أقل الصلاحيات بنيوي',
      check: async (_db, input) => input.roleKey !== 'OWNER',
    },
  ],
  async dryRun(db, input) {
    const role = await db.opsRole.findUnique({ where: { key: input.roleKey } });
    return {
      summaryAr: `سيُنشأ وكيل «${input.nameAr}» بدور ${input.roleKey} (${role?.nameAr ?? ''}) — رمز خدمة صالح ٢٤ ساعة`,
      before: null,
      after: { nameAr: input.nameAr, roleKey: input.roleKey, isActive: true },
    };
  },
  async execute(tx, input, ctx) {
    const role = await tx.opsRole.findUniqueOrThrow({ where: { key: input.roleKey } });
    const token = mintToken();
    const agent = await tx.agentAccount.create({
      data: {
        nameAr: input.nameAr,
        roleId: role.id,
        tokenHash: token.hash,
        tokenExpiresAt: token.expiresAt,
        createdBy: /^[0-9a-f-]{36}$/i.test(ctx.actor.id) ? ctx.actor.id : null,
      },
    });
    return {
      agentId: agent.id,
      token: token.raw,
      tokenExpiresAt: token.expiresAt.toISOString(),
    };
  },
  redactResult: (r) => ({
    agentId: r.agentId,
    token: '［عُرض مرة واحدة — غير مخزّن］',
    tokenExpiresAt: r.tokenExpiresAt,
  }),
};

const setActiveInput = z.object({
  agentId: z.string().uuid(),
  isActive: z.boolean(),
});

const agentSetActive: OperationDef<
  z.infer<typeof setActiveInput>,
  { agentId: string; isActive: boolean }
> = {
  key: 'agents.set-active',
  titleAr: 'تفعيل/تعطيل وكيل',
  descriptionAr:
    'تعطيل وكيل يرفض رمزه فوراً (والإيقاف الشامل الفوري لكل الوكلاء عبر AGENTS_ENABLED=false).',
  inputSchema: setActiveInput,
  permission: 'agents.manage',
  riskTier: 'SENSITIVE',
  reversible: true,
  compensatingKey: 'agents.set-active',
  requiresReason: true,
  preconditions: [
    {
      code: 'agent-missing',
      reasonAr: 'الوكيل غير موجود',
      check: async (db, input) =>
        !!(await db.agentAccount.findUnique({ where: { id: input.agentId }, select: { id: true } })),
    },
  ],
  async dryRun(db, input) {
    const a = await db.agentAccount.findUnique({ where: { id: input.agentId } });
    return {
      summaryAr: input.isActive
        ? `سيُفعَّل الوكيل «${a?.nameAr ?? input.agentId}»`
        : `سيُعطَّل الوكيل «${a?.nameAr ?? input.agentId}» — يُرفض رمزه فوراً`,
      before: { isActive: a?.isActive ?? null },
      after: { isActive: input.isActive },
    };
  },
  async execute(tx, input) {
    const a = await tx.agentAccount.update({
      where: { id: input.agentId },
      data: { isActive: input.isActive },
    });
    return { agentId: a.id, isActive: a.isActive };
  },
};

const rotateInput = z.object({ agentId: z.string().uuid() });

const agentTokenRotate: OperationDef<
  z.infer<typeof rotateInput>,
  { agentId: string; token: string; tokenExpiresAt: string }
> = {
  key: 'agents.token.rotate',
  titleAr: 'تدوير رمز وكيل',
  descriptionAr:
    'يستبدل رمز الخدمة فوراً (الرمز القديم يموت لحظياً). يُعرض الجديد مرة واحدة ولا يُخزَّن.',
  inputSchema: rotateInput,
  permission: 'agents.manage',
  riskTier: 'SENSITIVE',
  reversible: false,
  requiresReason: true,
  preconditions: [
    {
      code: 'agent-missing',
      reasonAr: 'الوكيل غير موجود',
      check: async (db, input) =>
        !!(await db.agentAccount.findUnique({ where: { id: input.agentId }, select: { id: true } })),
    },
  ],
  async dryRun(db, input) {
    const a = await db.agentAccount.findUnique({ where: { id: input.agentId } });
    return {
      summaryAr: `سيُدوَّر رمز الوكيل «${a?.nameAr ?? input.agentId}» — القديم يموت فوراً`,
      before: { tokenExpiresAt: a?.tokenExpiresAt?.toISOString() ?? null },
      after: { tokenExpiresAt: `+${AGENT_TOKEN_TTL_MS / 3_600_000} ساعة` },
    };
  },
  async execute(tx, input) {
    const token = mintToken();
    const a = await tx.agentAccount.update({
      where: { id: input.agentId },
      data: { tokenHash: token.hash, tokenExpiresAt: token.expiresAt },
    });
    return { agentId: a.id, token: token.raw, tokenExpiresAt: token.expiresAt.toISOString() };
  },
  redactResult: (r) => ({
    agentId: r.agentId,
    token: '［عُرض مرة واحدة — غير مخزّن］',
    tokenExpiresAt: r.tokenExpiresAt,
  }),
};

export function agentsOps(): Array<OperationDef<never, unknown>> {
  return [agentCreate, agentSetActive, agentTokenRotate] as unknown as Array<
    OperationDef<never, unknown>
  >;
}
