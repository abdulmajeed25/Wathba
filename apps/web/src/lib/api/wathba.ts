/**
 * Server-side fetchers for the Wathba (وثبة) ventures pillar.
 *
 * This file is the OUTBOUND ADAPTER between our copied-from-project200 UI
 * surface (which historically called `/v1/ventures…` shaped routes) and the
 * standalone Wathba NestJS API (`apps/api`, prefix `/v1`).  The five exports
 * keep their old signatures so no caller needed to change; field-mapping
 * happens here.
 *
 * Endpoint mapping (Wathba apps/api):
 *   listVentures        → GET  /v1/projects        — public list
 *   getTrustScore       → null (no equivalent yet in Wathba apps/api)
 *   listForumThreads    → null (no forum endpoint yet)
 *   listMyBackings      → GET  /v1/pledges/me     — bearer-protected
 *   listMyApplications  → null (no applications endpoint yet)
 *
 * Every fetcher returns `null` on failure (network or non-2xx) so the caller
 * can render the bundled fixture instead of a 500.
 */

import { cookies } from 'next/headers';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';

const SESSION_COOKIE = 'wathba_session';

export interface ApiVenture {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  state: string;
  fundingGoal: string;
  fundingCurrency: string;
  fundingRaised: string;
  fundingDeadline: string | null;
  trustScore: number | null;
  v2030AlignmentScore: number | null;
  impactJobsEstimate: number | null;
}

export interface ApiTrustScore {
  ventureId: string;
  score: number;
  band: 'low' | 'moderate' | 'high' | 'exceptional';
  reasons: string[];
  generatedAt: string;
  source: string;
}

export interface ApiForumAuthor {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ApiForumThread {
  id: string;
  ventureId: string;
  title: string;
  body: string;
  author: ApiForumAuthor;
  createdAt: string;
  replyCount: number;
  likeCount: number;
  pinned: boolean;
}

export interface ApiBackingRow {
  id: string;
  ventureId: string;
  backerUserId: string;
  amount: string;
  currency: string;
  committedAt: string;
  state: string;
  venture?: { id: string; slug: string; title: string; state: string };
}

export interface ApiApplicationRow {
  id: string;
  applicantUserId: string;
  state: string;
  submittedAt: string;
  position?: {
    id: string;
    title: string;
    venture?: { id: string; slug: string; title: string };
  };
}

/* ---------- HTTP helpers --------------------------------------------------- */

async function fetchJson<T>(
  path: string,
  revalidate = 30,
  token?: string | null,
): Promise<T | null> {
  try {
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate },
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Read the session cookie set by `/sign-in`'s server action. */
async function readSessionToken(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    /* `cookies()` throws outside a request context (e.g. build pre-render). */
    return null;
  }
}

/* ---------- Field adapters ------------------------------------------------- */

/**
 * apps/api `Project` (public toPublic shape) → our historical `ApiVenture`.
 * Wathba projects are halalas (1/100 SAR) ints — convert to string SAR.
 */
interface ApiProjectPublic {
  id: string;
  titleAr: string;
  shortDescAr: string;
  category: string;
  storyAr: string;
  mediaUrls: string[];
  fundingGoalHalalas: number;
  releaseThresholdPct: number;
  durationDays: number;
  deadline: string;
  status: string;
  raisedHalalas: number;
  backersCount: number;
  publishedAt: string | null;
}

function halalasToSar(halalas: number): string {
  return (halalas / 100).toFixed(0);
}

function projectToVenture(p: ApiProjectPublic): ApiVenture {
  return {
    id: p.id,
    slug: p.id, // apps/api has no slug column today; route uses id.
    title: p.titleAr,
    tagline: p.shortDescAr ?? null,
    state: p.status.toLowerCase(),
    fundingGoal: halalasToSar(p.fundingGoalHalalas),
    fundingCurrency: 'SAR',
    fundingRaised: halalasToSar(p.raisedHalalas),
    fundingDeadline: p.deadline,
    trustScore: null,
    v2030AlignmentScore: null,
    impactJobsEstimate: null,
  };
}

/* ---------- Public fetchers ----------------------------------------------- */

export async function listVentures(): Promise<ApiVenture[] | null> {
  const data = await fetchJson<{ items: ApiProjectPublic[] }>('/v1/projects');
  return data?.items.map(projectToVenture) ?? null;
}

export async function getTrustScore(_ventureId: string): Promise<ApiTrustScore | null> {
  /* Trust-score endpoint not yet shipped on the Wathba api — fall back. */
  return null;
}

export async function listForumThreads(_ventureId: string): Promise<ApiForumThread[] | null> {
  /* No forum module on Wathba apps/api yet. */
  return null;
}

export async function listMyBackings(token?: string | null): Promise<ApiBackingRow[] | null> {
  const bearer = token ?? (await readSessionToken());
  const data = await fetchJson<{ items: ApiBackingRow[] }>('/v1/pledges/me', 30, bearer);
  return data?.items ?? null;
}

export async function listMyApplications(
  _token?: string | null,
): Promise<ApiApplicationRow[] | null> {
  /* No /applications endpoint on Wathba apps/api yet (career/employment module
   * not in scope). */
  return null;
}

/* ---------- Live-bound v2 endpoints (transparency, milestones, RFQs) ------- */

export interface ApiMilestonePublic {
  id: string;
  projectId: string;
  order: number;
  titleAr: string;
  evidenceRequired: string;
  evidenceUrl: string | null;
  releasePct: number;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'RELEASED';
  releasedHalalas: number;
  submittedAt: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
}

export interface ApiBudgetSplitRow {
  milestoneId: string;
  label: string;
  pct: number;
  amountHalalas: number;
  status: string;
}

export interface ApiSpendLog {
  id: string;
  projectId: string;
  milestoneId: string | null;
  amountHalalas: number;
  descAr: string;
  date: string;
  proofUrl: string | null;
}

export interface ApiTransparencyPayload {
  budget: ApiBudgetSplitRow[];
  timeline: ApiSpendLog[];
}

export async function listProjectMilestones(
  projectId: string,
): Promise<ApiMilestonePublic[] | null> {
  const data = await fetchJson<{ items: ApiMilestonePublic[] }>(
    `/v1/projects/${projectId}/milestones`,
  );
  return data?.items ?? null;
}

export async function getProjectTransparency(
  projectId: string,
): Promise<ApiTransparencyPayload | null> {
  return fetchJson<ApiTransparencyPayload>(`/v1/projects/${projectId}/transparency`);
}

export interface ApiRfqPublic {
  id: string;
  ventureId: string;
  category: string;
  ventureTitleAr: string;
  ventureSlug: string;
  specsAr: string;
  dueDate: string;
  bidsCount: number;
  status: 'OPEN' | 'AWARDED' | 'CLOSED';
}

export interface ApiBidPublic {
  id: string;
  rfqId: string;
  rfqTitleAr: string;
  amountHalalas: number;
  leadTimeDays: number;
  status: 'PENDING' | 'AWARDED' | 'REJECTED';
  submittedAt: string;
}

export async function listRfqs(): Promise<ApiRfqPublic[] | null> {
  const data = await fetchJson<{ items: ApiRfqPublic[] }>(`/v1/rfqs`);
  return data?.items ?? null;
}

export async function listMyBids(token?: string | null): Promise<ApiBidPublic[] | null> {
  const bearer = token ?? (await readSessionToken());
  const data = await fetchJson<{ items: ApiBidPublic[] }>(`/v1/bids/me`, 30, bearer);
  return data?.items ?? null;
}

export interface ApiPayoutRow {
  id: string;
  projectId: string;
  amountHalalas: number;
  milestoneId: string | null;
  status: 'PENDING' | 'SENT' | 'FAILED';
  zatcaInvoiceId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface ApiPayoutsPayload {
  totalSentHalalas: number;
  items: ApiPayoutRow[];
}

export async function listMyPayouts(token?: string | null): Promise<ApiPayoutsPayload | null> {
  const bearer = token ?? (await readSessionToken());
  return fetchJson<ApiPayoutsPayload>(`/v1/payouts/me`, 30, bearer);
}
