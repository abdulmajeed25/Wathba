import { ConflictException } from '@nestjs/common';
import type { Pledge, Prisma } from '@prisma/client';
import { z } from 'zod';
import type { PricedAddOn, ProjectTerms, TierTerms } from './pledge-finalization';

const money = z.string().regex(/^\d+$/).transform(BigInt);
const date = z.string().datetime().transform(value => new Date(value));
const count = z.number().int().nonnegative().nullable();
const schema = z.object({
  version: z.literal(1), amountHalalas: money,
  project: z.object({ id: z.string().uuid(), fundingGoalHalalas: money,
    releaseThresholdPct: z.number().int().min(0).max(100), durationDays: z.number().int().positive(), deadline: date }).strict(),
  tier: z.object({ id: z.string().uuid(), amountHalalas: money, limitQty: count,
    requiresShipping: z.boolean(), includesPhysicalProduct: z.boolean(), shippingHalalas: money.nullable(),
    shipsTo: z.array(z.string()), earlyBirdAmountHalalas: money.nullable(), earlyBirdUntil: date.nullable() }).strict().nullable(),
  addOns: z.array(z.object({ addOnId: z.string().uuid(), qty: z.number().int().positive(),
    amountHalalas: money, unitPrice: money, limitQty: count }).strict()),
}).strict();

export function authorizationContext(project: ProjectTerms, tier: TierTerms | null, amountHalalas: bigint, addOns: PricedAddOn[]): Prisma.InputJsonValue {
  const { id, fundingGoalHalalas, releaseThresholdPct, durationDays, deadline } = project;
  const reward = tier ? { id: tier.id, amountHalalas: tier.amountHalalas, limitQty: tier.limitQty,
    requiresShipping: tier.requiresShipping, includesPhysicalProduct: tier.includesPhysicalProduct,
    shippingHalalas: tier.shippingHalalas, shipsTo: tier.shipsTo,
    earlyBirdAmountHalalas: tier.earlyBirdAmountHalalas, earlyBirdUntil: tier.earlyBirdUntil } : null;
  return JSON.parse(JSON.stringify({ version: 1, amountHalalas, project: { id, fundingGoalHalalas, releaseThresholdPct, durationDays, deadline }, tier: reward, addOns },
    (_key, value) => typeof value === 'bigint' ? value.toString() : value));
}

export function readAuthorizationContext(p: Pick<Pledge, 'authorizationContext' | 'projectId' | 'tierId' | 'amountHalalas' | 'addOnsHalalas'>) {
  const result = schema.safeParse(p.authorizationContext);
  if (!result.success) throw new ConflictException('لا توجد نسخة صالحة من شروط الدعم الأصلية؛ يلزم مراجعة الحجز.');
  const c = result.data;
  if (c.project.id !== p.projectId || (c.tier?.id ?? null) !== p.tierId || c.amountHalalas !== p.amountHalalas ||
      c.addOns.reduce((sum, a) => sum + a.amountHalalas, 0n) !== p.addOnsHalalas ||
      c.addOns.some(a => a.unitPrice * BigInt(a.qty) !== a.amountHalalas) ||
      new Set(c.addOns.map(a => a.addOnId)).size !== c.addOns.length)
    throw new ConflictException('شروط الحجز المحفوظة لا تطابق التعهد؛ يلزم المراجعة.');
  return c;
}
