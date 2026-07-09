import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * STAKES/O1 — whitelisted event names; unknown names are DROPPED (never
 * stored) so the table can't become a free-form data sink. Funnels are
 * documented in docs/analytics.md (O2).
 */
export const EVENT_WHITELIST = new Set([
  'page_view',
  'signup',
  'verify',
  'pledge_started',
  'pledge_completed',
  'project_submitted',
]);

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget semantics: an analytics failure must never 500 a flow. */
  async track(input: {
    name: string;
    anonId?: string | null;
    userId?: string | null;
    path?: string | null;
    props?: Record<string, unknown> | null;
  }): Promise<{ ok: true }> {
    if (!EVENT_WHITELIST.has(input.name)) return { ok: true }; // silently dropped
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          name: input.name,
          anonId: input.anonId ?? null,
          userId: input.userId ?? null,
          path: input.path?.slice(0, 300) ?? null,
          props: (input.props ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.warn(`event drop (${input.name}): ${(e as Error).message}`);
    }
    return { ok: true };
  }
}
