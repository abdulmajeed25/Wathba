import {
  deriveLiveProject,
  type WathbaProject as WathbaProjectShape,
  wathbaProjects,
} from './wathba-data';
import { getRichCampaign } from './wathba-rich';

/**
 * TABS — shared campaign resolution used by the persistent shell (layout)
 * and every tab route. Pure + synchronous: fixture skinning works exactly
 * as it did inside the old one-page WathbaCampaign.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isRealProject = (id: string): boolean => UUID_RE.test(id);

export interface ResolvedCampaign {
  found: WathbaProjectShape;
  active: ReturnType<typeof deriveLiveProject>;
  rich: ReturnType<typeof getRichCampaign>;
  /** True when the PAGE id is a DB UUID (live data paths). */
  isReal: boolean;
  /** The id live child surfaces must use: the page UUID, else the fixture id. */
  realId: string;
}

export function resolveCampaign(id: string, project?: WathbaProjectShape): ResolvedCampaign {
  const found = project ?? wathbaProjects.find((p) => p.id === id) ?? wathbaProjects[0]!;
  const active = deriveLiveProject(found);
  const rich = getRichCampaign(found.id, found.titleAr);
  const isReal = isRealProject(id);
  return { found, active, rich, isReal, realId: isReal ? id : active.id };
}

/** Tab registry — single source for the bar, the redirects and the e2e. */
export interface CampaignTabDef {
  /** Route segment under /projects/[id] ('' = the story page itself). */
  route: '' | 'rewards' | 'creator' | 'faqs' | 'updates' | 'comments' | 'community' | 'transparency';
  /** The pre-TABS anchor/?tab= key this tab replaces (back-compat map). */
  legacy: string;
  label: string;
  icon: string;
  /** Which live tab-counts field feeds the badge (fixture fallback in the bar). */
  countKey?: 'rewards' | 'faq' | 'updates' | 'comments';
}

export const CAMPAIGN_TABS: CampaignTabDef[] = [
  { route: '',             legacy: 'campaign',     label: 'الحملة',    icon: 'auto_stories' },
  { route: 'rewards',      legacy: 'rewards',      label: 'المكافآت',  icon: 'redeem',      countKey: 'rewards' },
  { route: 'creator',      legacy: 'creator',      label: 'المبدع',    icon: 'person' },
  { route: 'faqs',         legacy: 'faq',          label: 'الأسئلة',   icon: 'help',        countKey: 'faq' },
  { route: 'updates',      legacy: 'updates',      label: 'التحديثات', icon: 'campaign',    countKey: 'updates' },
  { route: 'comments',     legacy: 'comments',     label: 'التعليقات', icon: 'forum',       countKey: 'comments' },
  { route: 'community',    legacy: 'community',    label: 'المجتمع',   icon: 'category' },
  { route: 'transparency', legacy: 'transparency', label: 'الشفافية',  icon: 'query_stats' },
];

/** legacy anchor/?tab= key → route segment (old URLs must keep working). */
export const LEGACY_TAB_TO_ROUTE: Record<string, string> = Object.fromEntries(
  CAMPAIGN_TABS.map((t) => [t.legacy, t.route]),
);
