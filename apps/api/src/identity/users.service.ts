import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_PREF_DEFAULTS,
  resolvePrefs,
  type NotificationPrefKey,
} from '../notifications/notifications.service';
import type { User } from '@prisma/client';

/**
 * STAKES/C7 — handles a user may never CLAIM via settings (route segments,
 * brand, roles). The migration backfill may still have minted one of these
 * for a legitimately-named account (e.g. admin@wathba.demo → "admin") —
 * that's fine: it resolves to the real account; only new claims are blocked.
 */
const RESERVED_HANDLES = new Set([
  'admin', 'api', 'app', 'dashboard', 'help', 'me', 'projects', 'root',
  'settings', 'sign-in', 'sign-up', 'support', 'system', 'u', 'wathba', 'www',
]);

export const HANDLE_RE = /^[a-z0-9][a-z0-9_.-]{2,29}$/;

export interface ProfilePatch {
  name?: string;
  phone?: string;
  locale?: string;
  handle?: string;
  avatarUrl?: string | null;
  bioAr?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  socialLinks?: Array<{ platform: string; url: string }>;
  /** STAKES/E2 E3 — settings toggles. */
  notificationPrefs?: Partial<Record<NotificationPrefKey, boolean>>;
  profilePublic?: boolean;
  showBackedCount?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  /**
   * STAKES/B2 — `/me` view enriched with the count of projects this user has
   * created. The web uses it to decide creator-dashboard access (0 created ⇒
   * not yet a creator) and post-login routing, without an extra round-trip.
   */
  async meView(id: string): Promise<Record<string, unknown>> {
    const u = await this.findById(id);
    const createdProjectsCount = await this.prisma.project.count({
      where: { createdById: id },
    });
    return { ...this.toPublic(u), createdProjectsCount };
  }

  /** Strip server-only fields and convert BigInt for JSON. */
  toPublic(u: User): Record<string, unknown> {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      roles: u.roles,
      handle: u.handle,
      avatarUrl: u.avatarUrl,
      bioAr: u.bioAr,
      city: u.city,
      websiteUrl: u.websiteUrl,
      socialLinks: parseSocialLinks(u.socialLinks),
      notificationPrefs: resolvePrefs(u.notificationPrefs),
      profilePublic: u.profilePublic,
      showBackedCount: u.showBackedCount,
      nafathVerified: u.nafathVerified,
      reputationTier: u.reputationTier,
      totalPledgedHalalas: Number(u.totalPledgedHalalas),
      locale: u.locale,
      createdAt: u.createdAt.toISOString(),
    };
  }

  /**
   * STAKES/C3-C7 — extended profile update. Handle changes are validated
   * (shape + reserved words) and uniqueness violations surface as an Arabic
   * 409 instead of a raw P2002.
   */
  async updateProfile(id: string, patch: ProfilePatch): Promise<User> {
    const data: Prisma.UserUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.phone !== undefined) data.phone = patch.phone;
    if (patch.locale !== undefined) data.locale = patch.locale;
    if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl;
    if (patch.bioAr !== undefined) data.bioAr = patch.bioAr;
    if (patch.city !== undefined) data.city = patch.city;
    if (patch.websiteUrl !== undefined) data.websiteUrl = patch.websiteUrl;
    if (patch.socialLinks !== undefined) {
      data.socialLinks = patch.socialLinks as unknown as Prisma.InputJsonValue;
    }
    if (patch.notificationPrefs !== undefined) {
      // Store the FULL resolved set (defaults + patch) so future default
      // changes never silently flip an explicit user choice.
      data.notificationPrefs = {
        ...NOTIFICATION_PREF_DEFAULTS,
        ...Object.fromEntries(
          Object.entries(patch.notificationPrefs).filter(([, v]) => typeof v === 'boolean'),
        ),
      } as unknown as Prisma.InputJsonValue;
    }
    if (patch.profilePublic !== undefined) data.profilePublic = patch.profilePublic;
    if (patch.showBackedCount !== undefined) data.showBackedCount = patch.showBackedCount;
    if (patch.handle !== undefined) {
      const handle = patch.handle.toLowerCase();
      if (RESERVED_HANDLES.has(handle)) {
        throw new ConflictException('هذا المعرّف محجوز — اختر معرّفًا آخر');
      }
      data.handle = handle;
    }
    try {
      return await this.prisma.user.update({ where: { id }, data });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('هذا المعرّف مستخدم بالفعل — اختر معرّفًا آخر');
      }
      throw e;
    }
  }

  /**
   * STAKES/C7 — mint a unique handle from the email local-part at signup.
   * Falls back to a numeric suffix on collision; returns null when the
   * local-part sanitizes to fewer than 3 chars (user picks one in settings).
   */
  async generateHandle(email: string): Promise<string | null> {
    const raw = email
      .toLowerCase()
      .split('@')[0]!
      .replace(/[^a-z0-9_.-]/g, '')
      .slice(0, 30);
    if (raw.length < 3 || RESERVED_HANDLES.has(raw)) return null;
    for (let i = 0; i < 20; i++) {
      const candidate = i === 0 ? raw : `${raw.slice(0, 26)}-${i + 1}`;
      const taken = await this.prisma.user.findUnique({
        where: { handle: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return null;
  }

  /**
   * STAKES/C1 C5 — the public profile behind /u/[handle]. Accepts a handle or
   * a UUID (fallback so avatar links work even for handle-less legacy rows).
   * Narrow SELECT — never exposes email / phone / passwordHash / consent.
   */
  async publicProfile(handleOrId: string): Promise<Record<string, unknown>> {
    const key = handleOrId.toLowerCase();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key);
    const user = await this.prisma.user.findFirst({
      where: isUuid ? { OR: [{ handle: key }, { id: key }] } : { handle: key },
      select: {
        id: true,
        handle: true,
        name: true,
        avatarUrl: true,
        bioAr: true,
        city: true,
        websiteUrl: true,
        socialLinks: true,
        profilePublic: true,
        showBackedCount: true,
        nafathVerified: true,
        createdAt: true,
        creatorProfile: {
          select: { avatarUrl: true, bioAr: true, websiteUrl: true, followersCount: true },
        },
      },
    });
    if (!user) throw new NotFoundException('profile not found');
    // STAKES/E3 — a private profile is indistinguishable from a missing one.
    if (!user.profilePublic) throw new NotFoundException('profile not found');

    const [backed, created] = await Promise.all([
      // Projects this user backed — distinct, excluding failed payments.
      this.prisma.pledge.findMany({
        where: { backerId: user.id, status: { in: ['HELD', 'CAPTURED'] } },
        distinct: ['projectId'],
        select: { projectId: true },
      }),
      // Public created projects — published only, never DRAFT.
      this.prisma.project.findMany({
        where: {
          createdById: user.id,
          status: { not: ProjectStatus.DRAFT },
          publishedAt: { not: null },
        },
        select: {
          id: true,
          titleAr: true,
          status: true,
          raisedHalalas: true,
          fundingGoalHalalas: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: 24,
      }),
    ]);

    const cp = user.creatorProfile;
    return {
      id: user.id,
      handle: user.handle,
      name: user.name,
      // User-level avatar wins; fall back to the older creator-profile one.
      avatarUrl: user.avatarUrl ?? cp?.avatarUrl ?? null,
      bioAr: user.bioAr ?? cp?.bioAr ?? null,
      city: user.city,
      websiteUrl: user.websiteUrl ?? cp?.websiteUrl ?? null,
      socialLinks: parseSocialLinks(user.socialLinks),
      nafathVerified: user.nafathVerified,
      joinedAt: user.createdAt.toISOString(),
      stats: {
        // STAKES/E3 — backed count hidden (null) when the user opted out.
        backedCount: user.showBackedCount ? backed.length : null,
        createdCount: created.length,
        followersCount: cp?.followersCount ?? 0,
      },
      createdProjects: created.map((p) => {
        const goal = p.fundingGoalHalalas;
        const pct =
          goal > 0n ? Math.round(Number((p.raisedHalalas * 100n) / goal)) : 0;
        return {
          id: p.id,
          titleAr: p.titleAr,
          status: p.status,
          fundedPct: pct,
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        };
      }),
    };
  }
}

/** Defensive parse of the Json socialLinks column — discard malformed entries. */
function parseSocialLinks(raw: unknown): Array<{ platform: string; url: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ platform: string; url: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.platform === 'string' && typeof obj.url === 'string') {
      out.push({ platform: obj.platform, url: obj.url });
    }
  }
  return out;
}
