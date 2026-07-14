/**
 * OPS Part 2 — PDPL masking. PII is masked by DEFAULT in every ops screen
 * and API response; revealing a value is itself an operation
 * (users.pii.unmask — SENSITIVE, reason required, audited with the field,
 * the subject and the actor). Pure functions, no I/O.
 */

export const UNMASKABLE_FIELDS = ['email', 'phone'] as const;
export type UnmaskableField = (typeof UNMASKABLE_FIELDS)[number];

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const lastDot = domain.lastIndexOf('.');
  const tld = lastDot > 0 ? domain.slice(lastDot) : '';
  return `${local[0]}***@${domain[0] ?? ''}***${tld}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${'*'.repeat(Math.max(4, digits.length - 2))}${digits.slice(-2)}`;
}

/** Mask the standard user PII fields on any plain record in place-safe copy. */
export function maskUserPII<T extends { email?: string | null; phone?: string | null }>(
  row: T,
): T {
  return {
    ...row,
    ...('email' in row ? { email: maskEmail(row.email) } : {}),
    ...('phone' in row ? { phone: maskPhone(row.phone) } : {}),
  };
}
