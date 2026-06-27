import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationKind, type Notification, type Prisma } from '@prisma/client';

/**
 * Notifications context — DB-backed outbox.
 *
 * Other contexts call `create(...)` on key events; delivery (push/email) is
 * deferred to a future worker — for now the in-app screen reads from the
 * DB. This keeps notifications atomic with the event that produced them
 * (same transaction, no lost events).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userId: string;
    kind: NotificationKind;
    payload: Prisma.InputJsonValue;
    tx?: Pick<PrismaService, 'notification'>;
  }): Promise<Notification> {
    const client = input.tx ?? this.prisma;
    return client.notification.create({
      data: { userId: input.userId, kind: input.kind, payload: input.payload },
    });
  }

  async listMine(userId: string, opts: { take?: number; unreadOnly?: boolean } = {}) {
    const take = opts.take ?? 30;
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
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
