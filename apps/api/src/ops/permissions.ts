/**
 * OPS Part 2 — THE permission catalog and the 8-role matrix.
 *
 * Single source of truth: migration 0045 seeds the same matrix into OpsRole,
 * the spec `ops-rbac.spec.ts` asserts code ↔ DB parity, and the Part-5
 * permissions-matrix output renders from here. A permission is a string key
 * grouped by domain; '*' (OWNER only) matches everything.
 */

export const PERMISSIONS = {
  projects: ['projects.review', 'projects.feature', 'projects.lifecycle'],
  moderation: ['moderation.queue'],
  users: ['users.lifecycle', 'users.pii.unmask', 'users.roles.assign'],
  money: ['money.execute', 'money.approve'],
  content: ['content.editorial', 'content.collections', 'content.categories'],
  settings: ['settings.write'],
  support: ['support.tickets'],
  analytics: ['analytics.read'],
  audit: ['audit.read'],
} as const;

export const ALL_PERMISSIONS: readonly string[] = Object.values(PERMISSIONS).flat();

/** Holding any of these makes a user a "money admin" — the four-eyes counter
 *  and the mandatory-TOTP rule both key off this set. */
export const MONEY_PERMISSIONS: readonly string[] = ['*', 'money.execute', 'money.approve'];

export interface SeedRole {
  key: string;
  nameAr: string;
  permissions: readonly string[];
}

export const ROLE_MATRIX: readonly SeedRole[] = [
  { key: 'OWNER', nameAr: 'المالك', permissions: ['*'] },
  {
    key: 'OPS_MANAGER',
    nameAr: 'مدير العمليات',
    permissions: [
      'projects.review',
      'projects.feature',
      'projects.lifecycle',
      'moderation.queue',
      'users.lifecycle',
      'content.editorial',
      'content.collections',
      'content.categories',
      'support.tickets',
      'analytics.read',
      'audit.read',
    ],
  },
  { key: 'REVIEWER', nameAr: 'مراجع مشاريع', permissions: ['projects.review'] },
  {
    key: 'FINANCE',
    nameAr: 'المالية',
    permissions: ['money.execute', 'money.approve', 'analytics.read', 'audit.read'],
  },
  {
    key: 'SUPPORT',
    nameAr: 'الدعم',
    permissions: ['users.lifecycle', 'users.pii.unmask', 'support.tickets'],
  },
  { key: 'MODERATOR', nameAr: 'الثقة والسلامة', permissions: ['moderation.queue'] },
  {
    key: 'CONTENT_EDITOR',
    nameAr: 'محرر المحتوى',
    permissions: ['content.editorial', 'content.collections', 'content.categories'],
  },
  { key: 'ANALYST', nameAr: 'محلل بيانات', permissions: ['analytics.read', 'audit.read'] },
] as const;

export function permissionMatches(held: readonly string[], required: string): boolean {
  return held.includes('*') || held.includes(required);
}

export function holdsMoneyPermission(held: readonly string[]): boolean {
  return MONEY_PERMISSIONS.some((p) => held.includes(p));
}
