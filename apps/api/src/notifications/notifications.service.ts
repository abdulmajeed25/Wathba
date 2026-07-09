import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationKind, type Notification, type Prisma } from '@prisma/client';

/**
 * Notifications — DB-backed outbox. Other contexts call create() in the
 * same transaction as the domain event so notifications never drift.
 * Delivery (push/email) lands in a worker later.
 *
 * STAKES/E2 — per-type preferences: money-critical kinds always deliver;
 * the engagement kinds (project updates, comment replies) honor the user's
 * settings toggles. Campaign-outcome EMAILS are gated at the sender
 * (FundingService) via allows(); the in-app outcome notification always
 * lands because refund/charge state is transactional.
 */

export type NotificationPrefKey =
  | 'projectUpdates'
  | 'campaignOutcomes'
  | 'comments'
  | 'marketing';

export const NOTIFICATION_PREF_DEFAULTS: Record<NotificationPrefKey, boolean> = {
  projectUpdates: true,
  campaignOutcomes: true,
  comments: true,
  marketing: false,
};

/** In-app kinds gated by a pref key (everything else always delivers). */
const KIND_PREF: Partial<Record<NotificationKind, NotificationPrefKey>> = {
  [NotificationKind.UPDATE_POSTED]: 'projectUpdates',
  [NotificationKind.CREATOR_NEW_PROJECT]: 'projectUpdates',
  [NotificationKind.COMMENT_REPLY]: 'comments',
};

export function resolvePrefs(raw: unknown): Record<NotificationPrefKey, boolean> {
  const out = { ...NOTIFICATION_PREF_DEFAULTS };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of Object.keys(out) as NotificationPrefKey[]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === 'boolean') out[key] = v;
    }
  }
  return out;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * STAKES/S-11 F-05 — the follow loop's payoff: when a project goes LIVE
   * (admin approve OR the launch scheduler), every follower of the creator
   * gets an in-app notification + email, gated on the projectUpdates pref.
   * Fire-and-forget at the call sites — publishing never fails on fan-out.
   */
  async fanOutProjectPublished(projectId: string): Promise<{ notified: number }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        titleAr: true,
        slug: true,
        createdById: true,
        createdBy: { select: { name: true } },
      },
    });
    if (!project) return { notified: 0 };

    const followers = await this.prisma.creatorFollow.findMany({
      where: { creatorProfile: { userId: project.createdById } },
      select: { followerId: true },
    });
    const recipients = followers
      .map((f) => f.followerId)
      .filter((id) => id !== project.createdById);
    if (recipients.length === 0) return { notified: 0 };

    const allowed = await this.filterAllowed(recipients, 'projectUpdates');
    if (allowed.length === 0) return { notified: 0 };

    const deepLink = project.slug ? `/p/${project.slug}` : `/projects/${projectId}`;
    const { count } = await this.prisma.notification.createMany({
      data: allowed.map((userId) => ({
        userId,
        kind: NotificationKind.CREATOR_NEW_PROJECT,
        payload: {
          projectId,
          projectTitleAr: project.titleAr,
          creatorName: project.createdBy.name,
          deepLink,
        },
        dedupKey: `new-project:${projectId}:${userId}`,
      })),
      skipDuplicates: true,
    });

    // Emails ride the same opt-in; best-effort per recipient.
    const users = await this.prisma.user.findMany({
      where: { id: { in: allowed } },
      select: { email: true },
    });
    for (const u of users) {
      void this.email.creatorNewProject(u.email, {
        creatorName: project.createdBy.name,
        projectTitle: project.titleAr,
        link: deepLink,
      });
    }

    this.logger.log(
      `project=${projectId} publish fan-out notified=${count} followers=${recipients.length} optedIn=${allowed.length}`,
    );
    return { notified: count };
  }

  /** Does this user accept deliveries of the given pref type? */
  async allows(userId: string, key: NotificationPrefKey): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    return resolvePrefs(u?.notificationPrefs)[key];
  }

  /** Batch variant for fan-outs — returns the subset that opted IN. */
  async filterAllowed(userIds: string[], key: NotificationPrefKey): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, notificationPrefs: true },
    });
    return rows.filter((r) => resolvePrefs(r.notificationPrefs)[key]).map((r) => r.id);
  }

  async create(input: {
    userId: string;
    kind: NotificationKind;
    payload: Prisma.InputJsonValue;
    tx?: Pick<PrismaService, 'notification'>;
  }): Promise<Notification | null> {
    // STAKES/E2 — engagement kinds honor the per-type opt-out.
    const prefKey = KIND_PREF[input.kind];
    if (prefKey && !(await this.allows(input.userId, prefKey))) return null;
    const client = input.tx ?? this.prisma;
    return client.notification.create({
      data: { userId: input.userId, kind: input.kind, payload: input.payload },
    });
  }

  async listMine(userId: string, opts: { take?: number; unreadOnly?: boolean } = {}) {
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 30,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<{ ok: true }> {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count };
  }

  toPublic(n: Notification): Record<string, unknown> {
    return {
      id: n.id,
      userId: n.userId,
      kind: n.kind,
      payload: n.payload,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
