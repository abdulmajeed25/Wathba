export interface PledgePolicy {
  minHalalas: number;
  maxHalalas: number | null;
  methodsEnabled: { card: boolean; bnpl: boolean };
}

/** Reject missing/malformed policy rather than silently using demo limits. */
export function parsePledgePolicy(value: unknown): PledgePolicy | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Partial<PledgePolicy>;
  if (!Number.isSafeInteger(p.minHalalas) || p.minHalalas! < 1) return null;
  if (p.maxHalalas !== null && (!Number.isSafeInteger(p.maxHalalas) || p.maxHalalas! < 1)) return null;
  if (typeof p.methodsEnabled?.card !== 'boolean' || typeof p.methodsEnabled?.bnpl !== 'boolean') return null;
  return { minHalalas: p.minHalalas!, maxHalalas: p.maxHalalas!, methodsEnabled: { card: p.methodsEnabled.card, bnpl: p.methodsEnabled.bnpl } };
}
