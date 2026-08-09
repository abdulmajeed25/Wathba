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
  // Batch DISCOVERY-ENGINE Unit 5 — what the nightly promoter counts.
  'filter_applied',
  'search_performed',
]);

/**
 * The discovery dimensions a `filter_applied` event may name.
 *
 * A whitelist AGAIN, one level down. `EVENT_WHITELIST` keeps unknown event
 * names out of the table; without this, `filter_applied` would be a hole
 * straight through it — any client could post any key and any value and the
 * props column would be the free-form sink the first whitelist exists to
 * prevent. Anything not on this list is dropped from props, not 400'd: an
 * analytics call must never error a page.
 *
 * Mirrors the discover-all param whitelist. `q` is deliberately ABSENT — the
 * search TERM is user-authored text and storing it per event is a different
 * privacy question than storing "someone filtered by tag". `search_performed`
 * records that a search happened and which facets rode along with it, never
 * the words.
 */
export const FACET_KEY_WHITELIST = new Set([
  'status',
  'cat',
  'tag',
  'region',
  'pct',
  'only',
  'collection',
  'hasVideo',
  'duration',
  'sort',
]);

/** Bounds on a single facet value — a slug or an enum, never a paragraph. */
const MAX_FACET_VALUE = 64;

/**
 * Keep only the facet pairs, bounded and known.
 *
 * Returns a flat `{key, value}` rather than the caller's shape so the recompute
 * has ONE json path to group on. A props blob whose shape varies per client
 * version is a table you cannot aggregate.
 */
export function sanitizeFacetProps(
  props: Record<string, unknown> | null | undefined,
): { key: string; value: string } | null {
  const key = typeof props?.key === 'string' ? props.key : null;
  const value = typeof props?.value === 'string' ? props.value : null;
  if (!key || !value) return null;
  if (!FACET_KEY_WHITELIST.has(key)) return null;
  if (value.length > MAX_FACET_VALUE) return null;
  return { key, value };
}

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

    // Discovery events carry a facet pair and NOTHING ELSE — not the referral
    // blob every other event rides with, not whatever the client sent. This is
    // the only place the props of these two events are decided.
    let props = input.props ?? {};
    if (input.name === 'filter_applied' || input.name === 'search_performed') {
      const facet = sanitizeFacetProps(input.props);
      if (!facet) return { ok: true }; // nothing countable — drop it
      props = facet;
    }

    try {
      await this.prisma.analyticsEvent.create({
        data: {
          name: input.name,
          anonId: input.anonId ?? null,
          userId: input.userId ?? null,
          path: input.path?.slice(0, 300) ?? null,
          props: props as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.warn(`event drop (${input.name}): ${(e as Error).message}`);
    }
    return { ok: true };
  }
}
