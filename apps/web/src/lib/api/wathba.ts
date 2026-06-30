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
  rewardTiers?: Array<Record<string, unknown>>;
}

export async function getProjectDetail(
  projectId: string,
): Promise<ApiProjectDetail | null> {
  return fetchJson<ApiProjectDetail>(`/v1/projects/${projectId}`);
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
  bodyAr: string;
  likeCount: number;
  commentCount: number;
  date: string;
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
