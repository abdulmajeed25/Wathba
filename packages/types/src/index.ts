/**
 * Shared domain types for Wathba.
 * Money in `Halalas` (integer minor units; 100 halalas = 1 SAR).
 */

// ============================================================================
// MONEY
// ============================================================================

export type Halalas = number;
export const HALALAS_PER_SAR = 100;
export const toHalalas = (sar: number): Halalas => Math.round(sar * HALALAS_PER_SAR);
export const toSar = (h: Halalas): number => h / HALALAS_PER_SAR;

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]!);
}

export function fmtSAR(halalas: Halalas, opts: { arabic?: boolean } = {}): string {
  const sar = halalas / HALALAS_PER_SAR;
  const formatted = sar.toLocaleString('en-US', {
    maximumFractionDigits: sar % 1 === 0 ? 0 : 2,
  });
  const out = `${formatted} ر.س`;
  return opts.arabic ? toArabicDigits(out) : out;
}

// ============================================================================
// USER / IDENTITY
// ============================================================================

export type UserRole = 'CREATOR' | 'BACKER' | 'SUPPLIER' | 'ADMIN';

export type ReputationTier =
  | 'NEWCOMER' | 'SUPPORTER' | 'ADVOCATE' | 'AMBASSADOR' | 'FOUNDER';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  roles: UserRole[];
  nafathVerified: boolean;
  reputationTier: ReputationTier;
  totalPledgedHalalas: Halalas;
  locale: 'ar' | 'en';
  createdAt: string;
}

// ============================================================================
// PROJECT
// ============================================================================

export type ProjectCategory =
  | 'TECH' | 'DESIGN' | 'FILM' | 'MUSIC' | 'FOOD'
  | 'GAMES' | 'PUBLISHING' | 'FASHION' | 'ART' | 'SOCIAL';

export type ProjectStatus =
  | 'DRAFT' | 'UNDER_REVIEW' | 'LIVE'
  | 'SUCCESSFUL' | 'FAILED'
  | 'FUNDED' | 'IN_PRODUCTION' | 'DELIVERED'
  | 'REFUNDED';

/** §7 — Wathba-as-co-founder marker. */
export interface PlatformStake {
  isPartnered: true;
  stakeType: 'equity' | 'profit-share' | 'co-founder';
  disclosureAr: string;
}

export interface Project {
  id: string;
  titleAr: string;
  shortDescAr: string;
  category: ProjectCategory;
  storyAr: string;
  mediaUrls: string[];
  fundingGoalHalalas: Halalas;
  releaseThresholdPct: number; // §5 default 80
  durationDays: number;
  deadline: string;
  status: ProjectStatus;
  productSpecAr?: string | null;
  expectedDeliveryDate?: string | null;
  createdBy: string;
  raisedHalalas: Halalas;
  backersCount: number;
  platformPartner: PlatformStake | null;
  createdAt: string;
  publishedAt?: string | null;
}

// ============================================================================
// REWARDS
// ============================================================================

export interface RewardTier {
  id: string;
  projectId: string;
  titleAr: string;
  amountHalalas: Halalas;
  descAr: string;
  includesPhysicalProduct: boolean;
  requiresShipping: boolean;
  estDeliveryDate: string;
  limitQty?: number | null;
  claimedQty: number;
  popular?: boolean;
}

// ============================================================================
// PLEDGES / FUNDING
// ============================================================================

export type PledgeStatus = 'HELD' | 'CAPTURED' | 'REFUNDED' | 'FAILED';
export type ContractType = 'DONATION' | 'ISTISNA' | 'SALAM';

export interface ShippingAddress {
  name: string;
  address: string;
  city: string;
  country: string;
  postal: string;
}

export interface Pledge {
  id: string;
  backerId: string;
  projectId: string;
  tierId: string;
  amountHalalas: Halalas;
  status: PledgeStatus;
  shipping?: ShippingAddress | null;
  contractType: ContractType;
  paymentRef: string;
  createdAt: string;
  capturedAt?: string | null;
  refundedAt?: string | null;
}

// ============================================================================
// MILESTONES + TRANSPARENCY
// ============================================================================

export type MilestoneStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'RELEASED';

export interface Milestone {
  id: string;
  projectId: string;
  order: number;
  titleAr: string;
  releasePct: number;
  evidenceRequired: string;
  /** URL/path to the evidence uploaded by the creator at SUBMITTED. */
  evidenceUrl?: string | null;
  status: MilestoneStatus;
  releasedHalalas: Halalas;
  submittedAt?: string | null;
  approvedAt?: string | null;
  releasedAt?: string | null;
}

export interface SpendLog {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  amountHalalas: Halalas;
  descAr: string;
  date: string;
  proofUrl?: string | null;
}

// ============================================================================
// PROCUREMENT
// ============================================================================

export type RFQStatus = 'OPEN' | 'AWARDED' | 'CLOSED' | 'CANCELLED';
export type BidStatus = 'SUBMITTED' | 'SHORTLISTED' | 'AWARDED' | 'REJECTED';

export interface RFQ {
  id: string;
  projectId: string;
  specsAr: string;
  dueDate: string;
  status: RFQStatus;
  awardedBidId?: string | null;
  createdAt: string;
}

export interface SupplierBid {
  id: string;
  rfqId: string;
  supplierId: string;
  amountHalalas: Halalas;
  leadTimeDays: number;
  specComplianceNote: string;
  status: BidStatus;
  createdAt: string;
}

// ============================================================================
// PAYOUTS
// ============================================================================

export type PayoutStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface Payout {
  id: string;
  projectId: string;
  creatorId: string;
  amountHalalas: Halalas;
  milestoneId: string;
  status: PayoutStatus;
  zatcaInvoiceId?: string | null;
  sentAt?: string | null;
}

// ============================================================================
// UPDATES / COMMENTS / NOTIFICATIONS
// ============================================================================

export interface ProjectUpdate {
  id: string;
  projectId: string;
  titleAr: string;
  bodyAr: string;
  date: string;
}

export interface Comment {
  id: string;
  projectId: string;
  userId: string;
  bodyAr: string;
  date: string;
  parentId?: string | null;
}

export type NotificationKind =
  | 'PLEDGE_RECEIVED' | 'PROJECT_FUNDED' | 'PROJECT_FAILED'
  | 'MILESTONE_APPROVED' | 'PAYOUT_SENT' | 'UPDATE_POSTED' | 'RANK_UP';

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
}

// ============================================================================
// INVESTMENT — DORMANT (§6)
// ============================================================================

/**
 * SECURITIES-ADJACENT. Built but flagged OFF; never referenced by other
 * bounded contexts and never surfaced in UI/copy.
 */
export interface InvestmentOffer {
  id: string;
  projectId: string;
  profitSharePct: number;
  minTicketHalalas: Halalas;
  termsAr: string;
  status: 'DORMANT' | 'OPEN' | 'CLOSED';
  createdAt: string;
}
