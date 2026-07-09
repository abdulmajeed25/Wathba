/**
 * Server-side fetchers for the Wathba (وثبة) ventures pillar.
 *
 * This file is the OUTBOUND ADAPTER between the ventures-style UI surface
 * (which historically called `/v1/ventures…` shaped routes) and the standalone
 * Wathba NestJS API (`apps/api`, prefix `/v1`). The five exports keep their
 * old signatures so no caller needed to change; field-mapping happens here.
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
  /** Sprint 1 / P0-202 — refund visibility. */
  capturedAt: string | null;
  refundedAt: string | null;
  paymentRef: string | null;
  venture?: { id: string; slug: string; title: string; state: string };
}

/** Raw pledge row as `/v1/pledges/me` actually returns it. */
interface ApiPledgeRaw {
  id: string;
  projectId: string;
  backerId: string;
  amountHalalas: number;
  addOnsHalalas: number;
  status: string;
  createdAt: string;
  capturedAt: string | null;
  refundedAt: string | null;
  paymentRef: string | null;
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
    // Authed reads are per-user and MUST NOT enter the shared data cache
    // (Next keys the cache on URL, not on the Authorization header — caching
    // here would leak one user's rows to another and serve stale money
    // state). Public reads keep ISR-style revalidation.
    const res = await fetch(`${API_BASE}${path}`, {
      ...(token ? { cache: 'no-store' as const } : { next: { revalidate } }),
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
  const data = await fetchJson<{ items: ApiPledgeRaw[] }>('/v1/pledges/me', 30, bearer);
  if (!data?.items) return null;
  // Map the API pledge shape onto the UI row contract. Before Sprint 1 the
  // raw items were cast unmapped — `state`/`amount` were undefined and the
  // page 500'd for any signed-in backer with pledges.
  return data.items.map((r) => ({
    id: r.id,
    ventureId: r.projectId,
    backerUserId: r.backerId,
    amount: String(r.amountHalalas + (r.addOnsHalalas ?? 0)),
    currency: 'SAR',
    committedAt: r.createdAt,
    state: r.status,
    capturedAt: r.capturedAt,
    refundedAt: r.refundedAt,
    paymentRef: r.paymentRef,
  }));
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

export interface ApiProjectDetail {
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
  productSpecAr: string | null;
  expectedDeliveryDate: string | null;
  createdBy: string;
  raisedHalalas: number;
  backersCount: number;
  platformPartner: Record<string, unknown> | null;
  publishedAt: string | null;
  createdAt: string;
  /** CC-04 — admin review feedback surfaced to the creator. */
  reviewFeedback?: string | null;
  reviewedAt?: string | null;
  /** CC-14 — pause state + cumulative paused time (7-day cap). */
  pausedAt?: string | null;
  pausedMsAccrued?: number;
  /** CC-22 SEO + CC-20 scheduled launch. */
  slug?: string | null;
  ogImage?: string | null;
  metaDescription?: string | null;
  scheduledLaunchAt?: string | null;
  rewardTiers?: Array<Record<string, unknown>>;
}

export async function getProjectDetail(
  projectId: string,
): Promise<ApiProjectDetail | null> {
  return fetchJson<ApiProjectDetail>(`/v1/projects/${projectId}`);
}


export interface ApiChangeLogEntry {
  id: string;
  field: string;
  summaryAr: string;
  createdAt: string;
}

export interface ApiAnalytics {
  totals: {
    raisedHalalas: number;
    goalHalalas: number;
    backersCount: number;
    percentFunded: number;
    avgPledgeHalalas: number;
    capturedCount: number;
    heldCount: number;
    refundedCount: number;
  };
  pledgesOverTime: Array<{ date: string; count: number; amountHalalas: number }>;
  tierPerformance: Array<{ tierId: string; titleAr: string; backers: number; amountHalalas: number }>;
  updateEngagement: { updates: number; likes: number; comments: number };
  notTracked: string[];
}

/** CC-16 — owner-gated analytics (derived from pledges). */
export async function getProjectAnalytics(projectId: string): Promise<ApiAnalytics | null> {
  const token = await readSessionToken();
  return fetchJson<ApiAnalytics>(`/v1/projects/${projectId}/analytics`, 15, token);
}

export interface ApiFollowerRow {
  followerId: string;
  name: string;
  followedAt: string;
}

/** CC-17 — owner-gated follower roster. */
export async function getCreatorFollowers(
  userId: string,
): Promise<{ total: number; items: ApiFollowerRow[] } | null> {
  const token = await readSessionToken();
  return fetchJson<{ total: number; items: ApiFollowerRow[]; nextCursor: string | null }>(
    `/v1/creators/${userId}/followers`,
    15,
    token,
  );
}

/** CC-11 — public content change-log for a project (newest first). */
export async function getProjectChangelog(
  projectId: string,
): Promise<ApiChangeLogEntry[] | null> {
  const data = await fetchJson<{ items: ApiChangeLogEntry[] }>(
    `/v1/projects/${projectId}/changelog`,
    15,
  );
  return data?.items ?? null;
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
  specComplianceNote?: string;
  status: 'PENDING' | 'SUBMITTED' | 'AWARDED' | 'REJECTED';
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

export interface ApiRfqDetail extends ApiRfqPublic {
  awardedBidId: string | null;
  bids?: ApiBidPublic[];
}

/** Creator's RFQs for one project (Sprint 3 / P0-302). */
export async function listProjectRfqs(projectId: string): Promise<ApiRfqPublic[] | null> {
  const data = await fetchJson<{ items: ApiRfqPublic[] }>(`/v1/rfqs?projectId=${projectId}`);
  return data?.items ?? null;
}

/** One RFQ with its bids sorted ascending (reverse auction). */
export async function getRfqDetail(rfqId: string): Promise<ApiRfqDetail | null> {
  return fetchJson<ApiRfqDetail>(`/v1/rfqs/${rfqId}`, 0);
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

export interface ApiBeneficiary {
  type: 'BANK_ACCOUNT' | 'WALLET';
  name: string;
  ibanMasked: string | null;
  mobile: string;
  city: string | null;
  registered: boolean;
  updatedAt: string;
}

export async function getMyBeneficiary(token?: string | null): Promise<ApiBeneficiary | null> {
  const bearer = token ?? (await readSessionToken());
  const d = await fetchJson<{ beneficiary: ApiBeneficiary | null }>('/v1/payouts/beneficiary', 30, bearer);
  return d?.beneficiary ?? null;
}

export async function listMyPayouts(token?: string | null): Promise<ApiPayoutsPayload | null> {
  const bearer = token ?? (await readSessionToken());
  return fetchJson<ApiPayoutsPayload>(`/v1/payouts/me`, 30, bearer);
}

export interface ApiUserMe {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: string[];
  nafathVerified: boolean;
  reputationTier: string;
  totalPledgedHalalas: number;
  locale: string;
  createdAt: string;
  /** STAKES/B2 — projects this user has created (0 ⇒ not yet a creator). */
  createdProjectsCount?: number;
  /** STAKES/S-4 — user-level identity surface. */
  handle?: string | null;
  avatarUrl?: string | null;
  bioAr?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  socialLinks?: Array<{ platform: string; url: string }>;
  /** STAKES/S-7 — settings toggles. */
  notificationPrefs?: {
    projectUpdates?: boolean;
    campaignOutcomes?: boolean;
    comments?: boolean;
    marketing?: boolean;
  };
  profilePublic?: boolean;
  showBackedCount?: boolean;
}

export interface ApiRewardTier {
  id: string;
  projectId: string;
  titleAr: string;
  amountHalalas: number;
  descAr: string;
  includesPhysicalProduct: boolean;
  requiresShipping: boolean;
  estDeliveryDate: string;
  limitQty: number | null;
  claimedQty: number;
  popular: boolean;
  featured: boolean;
  includedItems: Array<{ nameAr: string; qty?: number; thumbnailUrl?: string }>;
  shipsTo: string[];
  sortOrder: number;
  // CC-13 — close/early-bird controls.
  isActive?: boolean;
  earlyBirdAmountHalalas?: number | null;
  earlyBirdUntil?: string | null;
  earlyBirdActive?: boolean;
  effectiveAmountHalalas?: number;
}

export interface ApiAddOn {
  id: string;
  projectId: string;
  titleAr: string;
  amountHalalas: number;
  descAr: string;
  imageUrl: string | null;
  limitQty: number | null;
  claimedQty: number;
  sortOrder: number;
}

export interface ApiTabCounts {
  rewards: number;
  addons: number;
  comments: number;
  updates: number;
  faq: number;
  questions: number;
  contests: number;
}

export async function listRewardTiers(projectId: string): Promise<ApiRewardTier[] | null> {
  const d = await fetchJson<{ items: ApiRewardTier[] }>(`/v1/projects/${projectId}/reward-tiers`);
  return d?.items ?? null;
}

export async function listAddOns(projectId: string): Promise<ApiAddOn[] | null> {
  const d = await fetchJson<{ items: ApiAddOn[] }>(`/v1/projects/${projectId}/addons`);
  return d?.items ?? null;
}

export async function getTabCounts(projectId: string): Promise<ApiTabCounts | null> {
  return fetchJson<ApiTabCounts>(`/v1/projects/${projectId}/tab-counts`, 15);
}

export async function getMe(token?: string | null): Promise<ApiUserMe | null> {
  const bearer = token ?? (await readSessionToken());
  return fetchJson<ApiUserMe>(`/v1/users/me`, 0, bearer);
}

export interface ApiSearchHit {
  id: string;
  titleAr: string;
  shortDescAr: string;
  category: string;
  raisedHalalas: number;
  fundingGoalHalalas: number;
  daysLeft: number;
  status: string;
}

/** Postgres FTS — public endpoint, no auth. */
export async function searchProjects(q: string, limit = 20): Promise<ApiSearchHit[] | null> {
  if (!q.trim()) return [];
  const data = await fetchJson<{ items: ApiSearchHit[] }>(
    `/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
  return data?.items ?? null;
}

/* ---------- Engagement: Comments + Updates (Slice 2B) --------------------- */

export interface ApiCommentPublic {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  /** STAKES/C10 — link the author to /u/[handle] + render the avatar. */
  userHandle?: string | null;
  userAvatarUrl?: string | null;
  isCreator: boolean;
  pinned: boolean;
  hidden: boolean;
  likeCount: number;
  bodyAr: string | null;
  parentId: string | null;
  date: string;
}

export interface ApiCommentsPage {
  items: ApiCommentPublic[];
  nextCursor: string | null;
}

/**
 * GET /v1/projects/:projectId/comments  (public)
 * Pinned float first; then chronological newest→oldest, cursor-paginated.
 */
export async function listProjectComments(
  projectId: string,
  opts: { take?: number; parentId?: string; cursor?: string } = {},
): Promise<ApiCommentsPage | null> {
  const qs = new URLSearchParams();
  if (opts.take) qs.set('take', String(opts.take));
  if (opts.parentId) qs.set('parentId', opts.parentId);
  if (opts.cursor) qs.set('cursor', opts.cursor);
  const path = `/v1/projects/${projectId}/comments${qs.toString() ? `?${qs.toString()}` : ''}`;
  return fetchJson<ApiCommentsPage>(path, 0);
}

export interface ApiUpdatePublic {
  id: string;
  projectId: string;
  orderNum: number;
  titleAr: string;
  bodyAr: string | null;
  likeCount: number;
  commentCount: number;
  date: string;
  // CC-12 — backer-only bodies are withheld from non-backers.
  visibility?: 'PUBLIC' | 'BACKERS_ONLY';
  locked?: boolean;
}

/**
 * GET /v1/projects/:projectId/updates  (public)
 */
export async function listProjectUpdates(
  projectId: string,
  opts: { take?: number } = {},
): Promise<{ items: ApiUpdatePublic[] } | null> {
  const qs = new URLSearchParams();
  if (opts.take) qs.set('take', String(opts.take));
  const path = `/v1/projects/${projectId}/updates${qs.toString() ? `?${qs.toString()}` : ''}`;
  return fetchJson<{ items: ApiUpdatePublic[] }>(path, 0);
}

/**
 * GET /v1/projects/:projectId/updates/:updateId  (public permalink)
 */
export async function getProjectUpdate(
  projectId: string,
  updateId: string,
): Promise<ApiUpdatePublic | null> {
  return fetchJson<ApiUpdatePublic>(`/v1/projects/${projectId}/updates/${updateId}`, 30);
}

/* ---------- Notifications (Slice 2.6) ------------------------------------ */

export type NotificationKind =
  | 'PLEDGE_RECEIVED'
  | 'PROJECT_FUNDED'
  | 'PROJECT_FAILED'
  | 'MILESTONE_APPROVED'
  | 'PAYOUT_SENT'
  | 'UPDATE_POSTED'
  | 'CREATOR_NEW_PROJECT'
  | 'RANK_UP'
  | 'CONTEST_OPENED'
  | 'CONTEST_ANNOUNCED'
  | 'FAQ_ANSWERED'
  | 'COMMENT_REPLY';

export interface ApiNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface ApiNotificationsPage {
  items: ApiNotification[];
  unreadCount: number;
}

export async function listMyNotifications(
  opts: { unreadOnly?: boolean; take?: number } = {},
  token?: string | null,
): Promise<ApiNotificationsPage | null> {
  const qs = new URLSearchParams();
  if (opts.unreadOnly) qs.set('unread', 'true');
  if (opts.take) qs.set('take', String(opts.take));
  const path = `/v1/notifications/me${qs.toString() ? `?${qs.toString()}` : ''}`;
  const bearer = token ?? (await readSessionToken());
  return fetchJson<ApiNotificationsPage>(path, 0, bearer);
}

/* ---------- Admin (Slice 2.7) -------------------------------------------- */

export interface ApiKycRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export async function listReviewQueue(
  token?: string | null,
): Promise<{ items: ApiProjectDetail[] } | null> {
  const bearer = token ?? (await readSessionToken());
  return fetchJson<{ items: ApiProjectDetail[] }>(`/v1/admin/review-queue`, 0, bearer);
}

/** STAKES/K2 K3 — admin moderation queue (reported comments + projects). */
export interface ApiModerationQueue {
  comments: Array<{
    id: string;
    projectId: string;
    projectTitleAr: string;
    authorName: string;
    authorHandle: string | null;
    bodyAr: string;
    reportCount: number;
    reasons: string[];
    date: string;
  }>;
  projects: Array<{
    projectId: string;
    titleAr: string;
    status: string | null;
    reportCount: number;
  }>;
}

export async function getModerationQueue(
  token?: string | null,
): Promise<ApiModerationQueue | null> {
  const bearer = token ?? (await readSessionToken());
  return fetchJson<ApiModerationQueue>(`/v1/admin/moderation`, 0, bearer);
}

export async function listKycQueue(
  token?: string | null,
): Promise<{ items: ApiKycRow[] } | null> {
  const bearer = token ?? (await readSessionToken());
  return fetchJson<{ items: ApiKycRow[] }>(`/v1/admin/kyc-queue`, 0, bearer);
}

/* ---------- Contests (Slice 2C — Comment & Win) -------------------------- */

export type ContestStatusVal = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ANNOUNCED';

export interface ApiContestWinner {
  backerId: string;
  backerNo: number;
}

export interface ApiContest {
  id: string;
  projectId: string;
  roundNum: number;
  promptAr: string;
  status: ContestStatusVal;
  winnersCount: number;
  prizeRewardTierId: string | null;
  prizeAddOnId: string | null;
  prizeCustomAr: string | null;
  startsAt: string | null;
  endsAt: string | null;
  announcedAt: string | null;
  createdAt: string;
  winners: ApiContestWinner[];
}

export async function listContests(projectId: string): Promise<ApiContest[] | null> {
  const d = await fetchJson<{ items: ApiContest[] }>(`/v1/projects/${projectId}/contests`);
  return d?.items ?? null;
}

/* ---------- FAQ (Slice 2C) ----------------------------------------------- */

export interface ApiFaqItem {
  id: string;
  projectId: string;
  questionAr: string;
  answerAr: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type FaqQuestionStatus = 'PENDING' | 'ANSWERED' | 'REJECTED';

export interface ApiFaqQuestion {
  id: string;
  projectId: string;
  askerId: string;
  bodyAr: string;
  status: FaqQuestionStatus;
  answeredFaqItemId: string | null;
  createdAt: string;
}

export async function listFaqItems(projectId: string): Promise<ApiFaqItem[] | null> {
  const d = await fetchJson<{ items: ApiFaqItem[] }>(`/v1/projects/${projectId}/faq`);
  return d?.items ?? null;
}

export async function listFaqQuestions(
  projectId: string,
): Promise<ApiFaqQuestion[] | null> {
  const d = await fetchJson<{ items: ApiFaqQuestion[] }>(
    `/v1/projects/${projectId}/faq/questions`,
  );
  return d?.items ?? null;
}

/* ---------- Community (Slice 2D) ----------------------------------------- */

export interface ApiCommunityRow {
  key: string;
  backers: number;
}

export interface ApiCommunitySnapshot {
  topCities: ApiCommunityRow[];
  topCountries: ApiCommunityRow[];
  totals: { newCount: number; returningCount: number; total: number };
}

export async function getCommunitySnapshot(
  projectId: string,
): Promise<ApiCommunitySnapshot | null> {
  return fetchJson<ApiCommunitySnapshot>(`/v1/projects/${projectId}/community`);
}

/* ---------- Creator profile (Slice 2D) ----------------------------------- */

export interface ApiCreatorCollaborator {
  nameAr: string;
  role?: string;
  avatarUrl?: string;
}

export interface ApiCreatorPastProject {
  id: string;
  titleAr: string;
  raisedHalalas: number;
  fundingGoalHalalas: number;
  status: string;
  fundedPct: number;
  delivered: boolean;
  publishedAt: string | null;
}

export interface ApiCreatorProfile {
  userId: string;
  name: string;
  /** STAKES/C10 — public-profile handle (/u/[handle]); null for legacy rows. */
  handle?: string | null;
  nafathVerified: boolean;
  avatarUrl: string | null;
  bioAr: string | null;
  websiteUrl: string | null;
  collaborators: ApiCreatorCollaborator[];
  followersCount: number;
  createdProjectsCount: number;
  backedProjectsCount: number;
  lastSeenAt: string | null;
  pastProjects: ApiCreatorPastProject[];
}

export async function getCreatorProfile(
  userId: string,
): Promise<ApiCreatorProfile | null> {
  return fetchJson<ApiCreatorProfile>(`/v1/creators/${userId}`);
}

/* ---------- STAKES/S-4 — public user profile (/u/[handle]) ---------------- */

export interface ApiPublicProfile {
  id: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  bioAr: string | null;
  city: string | null;
  websiteUrl: string | null;
  socialLinks: Array<{ platform: string; url: string }>;
  nafathVerified: boolean;
  joinedAt: string;
  /** backedCount is null when the user hides it (showBackedCount=false). */
  stats: { backedCount: number | null; createdCount: number; followersCount: number };
  createdProjects: Array<{
    id: string;
    titleAr: string;
    status: string;
    fundedPct: number;
    publishedAt: string | null;
  }>;
}

/** STAKES/J3 J4 — compact card shape for the projects rails. */
export interface ApiRailProject {
  id: string;
  titleAr: string;
  shortDescAr: string;
  slug: string | null;
  status: string;
  fundedPct: number;
  deadline: string;
}

/** STAKES/J3 — LIVE projects in the same (sub)category. Public. */
export async function getSimilarProjects(
  projectId: string,
): Promise<ApiRailProject[]> {
  const data = await fetchJson<{ items: ApiRailProject[] }>(
    `/v1/projects/${projectId}/similar`,
    60,
  );
  return data?.items ?? [];
}

/** STAKES/J4 — "لأنك دعمت…" for the signed-in home. */
export async function getRecommendedProjects(
  token?: string | null,
): Promise<{ items: ApiRailProject[]; basedOn: string[] } | null> {
  const bearer = token ?? (await readSessionToken());
  if (!bearer) return null;
  return fetchJson<{ items: ApiRailProject[]; basedOn: string[] }>(
    '/v1/discover/recommended',
    0,
    bearer,
  );
}

/** STAKES/S-10 F-03 — one saved-project card as the discover API returns it. */
export interface ApiSavedCard {
  id: string;
  titleAr: string;
  shortDescAr: string;
  status: string;
  fundingGoalHalalas: number;
  raisedHalalas: number;
  deadline: string;
  slug: string | null;
  creatorName: string;
}

/** STAKES/S-10 F-10 — every LIVE/FUNDED project (id + slug) for the sitemap.
 *  Pages through discover (the plain projects list is first-page-only), capped
 *  at 10 pages / 480 projects so a runaway dataset can't stall ISR. */
export async function listSitemapProjects(): Promise<Array<{ id: string; slug: string | null }> | null> {
  const out: Array<{ id: string; slug: string | null }> = [];
  for (let page = 0; page < 10; page++) {
    // revalidate 0: the DATA cache must not pin a build-time snapshot — the
    // build prerender caches this URL for an hour and a fresh route render
    // then serves stale projects (no new slugs). Freshness per render; the
    // route itself is the caching layer.
    const data = await fetchJson<{ items: Array<{ id: string; slug: string | null }>; hasMore: boolean }>(
      `/v1/discover?status=live,funded&take=48&page=${page}`,
      0,
    );
    if (!data?.items) return out.length > 0 ? out : null;
    out.push(...data.items.map((p) => ({ id: p.id, slug: p.slug })));
    if (!data.hasMore) break;
  }
  return out;
}

/** Bearer-protected; revalidate 0 — bookmarks must reflect instantly. */
export async function listMySaved(token?: string | null): Promise<ApiSavedCard[] | null> {
  const bearer = token ?? (await readSessionToken());
  if (!bearer) return null;
  const data = await fetchJson<{ items: ApiSavedCard[] }>('/v1/discover?only=saved&take=24', 0, bearer);
  return data?.items ?? null;
}

/** Public + anonymous — accepts a handle or a UUID fallback.
 *  revalidate 0: privacy toggles (STAKES/E3) must apply instantly — a 30s
 *  data-cache window kept a just-hidden profile publicly readable. */
export async function getPublicProfile(
  handleOrId: string,
): Promise<ApiPublicProfile | null> {
  return fetchJson<ApiPublicProfile>(
    `/v1/profiles/${encodeURIComponent(handleOrId)}`,
    0,
  );
}

/* ---------- Batch CAT — taxonomy + discovery ------------------------------ */

export interface ApiCategoryNode {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  liveCount: number;
  children: ApiCategoryNode[];
}

/** Full two-level tree (top-level → subcategories) with rolled-up LIVE counts. */
export async function listCategories(): Promise<ApiCategoryNode[] | null> {
  return fetchJson<ApiCategoryNode[]>('/v1/categories', 300);
}

/** One top-level node + its children + counts (discover landing header). */
export async function getCategoryBySlug(slug: string): Promise<ApiCategoryNode | null> {
  return fetchJson<ApiCategoryNode>(`/v1/categories/${encodeURIComponent(slug)}`, 300);
}

/** Public project card shape as toPublic() emits it (Batch CAT fields included). */
export interface ApiDiscoverProject {
  id: string;
  titleAr: string;
  shortDescAr: string;
  category: string | null;
  categoryId: string | null;
  region: string | null;
  isStaffPick: boolean;
  status: string;
  fundingGoalHalalas: number;
  raisedHalalas: number;
  backersCount: number;
  deadline: string;
  publishedAt: string | null;
  mediaUrls: string[];
  slug: string | null;
}

export interface ApiDiscoverResult {
  items: ApiDiscoverProject[];
  nextCursor: string | null;
}

export type DiscoveryFilter =
  | 'trending'
  | 'nearly_funded'
  | 'just_launched'
  | 'near_you'
  | 'staff_pick';

export interface DiscoverParams {
  categorySlug?: string;
  subSlug?: string;
  filter?: DiscoveryFilter;
  region?: string;
  sort?: 'new' | 'ending_soon' | 'most_funded';
  take?: number;
  cursor?: string;
}

/* ---------- Batch DISC — advanced discover page --------------------------- */

export interface ApiDiscoverCard {
  id: string;
  titleAr: string;
  shortDescAr: string;
  categoryId: string | null;
  region: string | null;
  isStaffPick: boolean;
  status: string;
  fundingGoalHalalas: number;
  raisedHalalas: number;
  backersCount: number;
  deadline: string;
  publishedAt: string | null;
  mediaUrls: string[];
  slug: string | null;
  saved: boolean;
}

export interface ApiDiscoverAllResult {
  items: ApiDiscoverCard[];
  total: number;
  page: number;
  take: number;
  hasMore: boolean;
}

export interface ApiDiscoverFacets {
  statuses: { live: number; funded: number; ended: number };
  categories: Array<{ slug: string; nameAr: string; parentSlug: string | null; count: number }>;
  regions: Record<string, number>;
  pct: Record<string, number>;
  goals: Record<string, number>;
  raised: Record<string, number>;
  staff: number;
  collections: Array<{ slug: string; nameAr: string; count: number }>;
}

/** Build the discover query string from a flat searchParams-like record. */
export function discoverQS(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** GET /v1/discover — the advanced list (SSR passes the session token for `saved`). */
export async function listDiscoverAll(
  params: Record<string, string | undefined>,
  token?: string | null,
): Promise<ApiDiscoverAllResult | null> {
  const bearer = token ?? (await readSessionToken());
  return fetchJson<ApiDiscoverAllResult>(`/v1/discover${discoverQS(params)}`, 30, bearer);
}

/** GET /v1/discover/facets — live counts respecting the other filters. */
export async function getDiscoverFacets(
  params: Record<string, string | undefined>,
  token?: string | null,
): Promise<ApiDiscoverFacets | null> {
  const bearer = token ?? (await readSessionToken());
  return fetchJson<ApiDiscoverFacets>(`/v1/discover/facets${discoverQS(params)}`, 30, bearer);
}

export async function listActiveCollections(): Promise<Array<{
  slug: string;
  nameAr: string;
  descriptionAr: string;
  showInMenu: boolean;
}> | null> {
  return fetchJson('/v1/collections', 120);
}

/** GET /v1/projects with the Batch CAT category + discovery filters. */
export async function listDiscover(params: DiscoverParams): Promise<ApiDiscoverResult | null> {
  const qs = new URLSearchParams();
  if (params.categorySlug) qs.set('categorySlug', params.categorySlug);
  if (params.subSlug) qs.set('subSlug', params.subSlug);
  if (params.filter) qs.set('filter', params.filter);
  if (params.region) qs.set('region', params.region);
  if (params.sort) qs.set('sort', params.sort);
  if (params.take) qs.set('take', String(params.take));
  if (params.cursor) qs.set('cursor', params.cursor);
  const q = qs.toString();
  return fetchJson<ApiDiscoverResult>(`/v1/projects${q ? `?${q}` : ''}`, 60);
}
