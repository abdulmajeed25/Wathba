/**
 * Shared domain types for Wathba.
 *
 * All monetary values are SAR (integer minor units / halalas — 100 halalas = 1 SAR).
 * UI formats halalas → SAR with the SAR formatter.
 */

// ============================================================================
// MONEY
// ============================================================================

/** SAR in halalas (1 SAR = 100 halalas). Always an integer. */
export type Halalas = number;

export const HALALAS_PER_SAR = 100;
export const toHalalas = (sar: number): Halalas => Math.round(sar * HALALAS_PER_SAR);
export const toSar = (h: Halalas): number => h / HALALAS_PER_SAR;

// ============================================================================
// USER / IDENTITY
// ============================================================================

export type UserRole = 'creator' | 'backer' | 'supplier' | 'admin';

export type ReputationTier = 'newcomer' | 'supporter' | 'advocate' | 'ambassador' | 'founder';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  roles: UserRole[];
  nafathVerified: boolean;
  reputationTier: ReputationTier;
  totalPledgedHalalas: Halalas;
  createdAt: string;
}

// ============================================================================
// PROJECT
// ============================================================================

export type ProjectCategory =
  | 'tech'
  | 'design'
  | 'film'
  | 'music'
  | 'food'
  | 'games'
  | 'publishing'
  | 'fashion'
  | 'art'
  | 'social';

export type ProjectStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'LIVE'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'FUNDED'
  | 'IN_PRODUCTION'
  | 'DELIVERED'
  | 'REFUNDED';

/** Wathba-as-co-founder marker (§6). */
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
  /** Total target the creator wants raised, in halalas. */
  fundingGoalHalalas: Halalas;
  /** Threshold % at which the project is considered SUCCESSFUL. Default 80. */
  releaseThresholdPct: number;
  durationDays: number;
  deadline: string; // ISO
  status: ProjectStatus;
  /** Required if any tier `includesPhysicalProduct`. */
  productSpecAr?: string | null;
  /** Required if any tier `includesPhysicalProduct`. */
  expectedDeliveryDate?: string | null;
  createdBy: string;
  raisedHalalas: Halalas; // derived
  backersCount: number; // derived
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
  estDeliveryDate: string; // ISO
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
// MILESTONES
// ============================================================================

export type MilestoneStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'RELEASED';

export interface Milestone {
  id: string;
  projectId: string;
  order: number;
  titleAr: string;
  /** Percentage of total raised funds released at this milestone. */
  releasePct: number;
  evidenceRequired: string;
  status: MilestoneStatus;
  releasedHalalas: Halalas;
  submittedAt?: string | null;
  approvedAt?: string | null;
  releasedAt?: string | null;
}

// ============================================================================
// SPEND LOG (live transparency)
// ============================================================================

export interface SpendLog {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  amountHalalas: Halalas;
  descAr: string;
  date: string; // ISO
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
// PAYOUTS / ZATCA
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
// UPDATES / COMMENTS
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

// ============================================================================
// INVESTMENT (DORMANT — feature-flagged OFF, never imported by other contexts)
// ============================================================================

/**
 * SECURITIES-ADJACENT TYPES — DO NOT USE IN PRODUCTION UI.
 * These exist only so the `investment` bounded context compiles. The
 * `INVESTMENT_ENABLED` feature flag MUST remain false until a Saudi
 * securities license is obtained. Importing this from any other context
 * triggers a lint rule.
 */
export interface InvestmentOffer {
  id: string;
  projectId: string;
  /** Percentage of profit share offered to backers. */
  profitSharePct: number;
  minTicketHalalas: Halalas;
  termsAr: string;
  status: 'DORMANT' | 'OPEN' | 'CLOSED';
  createdAt: string;
}

// ============================================================================
// FORMATTERS (Arabic / SAR)
// ============================================================================

/** Format halalas as "1,234 ر.س". */
export function formatSAR(halalas: Halalas, locale = 'ar-SA'): string {
  const sar = halalas / HALALAS_PER_SAR;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: sar % 1 === 0 ? 0 : 2,
  }).format(sar);
}
