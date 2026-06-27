/**
 * Ventures types — Brief 6 §4–§6 verbatim (lifecycle, backing, ledger,
 * milestones, governance, employment, treasury, disputes).
 */

export type VentureState = 'raising' | 'active' | 'milestoneHold' | 'closed';

export type BackingType = 'reward' | 'equity' | 'royalty' | 'strategicSponsor';

export type PledgeTiming = 'soft' | 'direct' | 'recurring';

export interface VentureSector {
  slug: string;
  name: string;
}

export interface VentureMember {
  handle: string;
  displayName: string;
  role: 'founder' | 'core' | 'advisor';
}

export interface VentureSummary {
  id: string;
  handle: string;
  name: string;
  tagline: string;
  state: VentureState;
  sectors: readonly VentureSector[];
  raisedSar: number;
  targetSar: number;
  backerCount: number;
  trustScore: number;
  impactPct: number;
  acceptedBackingTypes: readonly BackingType[];
  founderHandle: string;
}

export interface VentureDetail extends VentureSummary {
  description: string;
  problemStatement: string;
  solutionStatement: string;
  marketBlurb: string;
  useOfFunds: string;
  team: readonly VentureMember[];
  milestones: readonly Milestone[];
  openRoles: readonly OpenRole[];
  spaceId: string | null;
  updates: readonly VentureUpdate[];
  v2030Mapping: readonly { sectorSlug: string; sectorName: string; pct: number }[];
}

export type MilestoneState = 'planned' | 'active' | 'evidence' | 'voting' | 'passed' | 'failed';

export interface Milestone {
  id: string;
  number: number;
  title: string;
  targetDate: string;
  state: MilestoneState;
  evidenceUrl: string | null;
  auditComment: string | null;
  voteOpensAt: string | null;
  voteClosesAt: string | null;
}

export interface OpenRole {
  id: string;
  title: string;
  postedAt: string;
  applicantCount: number;
}

export interface VentureUpdate {
  id: string;
  title: string;
  body: string;
  postedAt: string;
  authorHandle: string;
}

// ── Trust + Impact ─────────────────────────────────────────────────────────

export interface TrustScoreBreakdown {
  score: number;
  factors: Record<
    'ledgerHealth' | 'milestonePace' | 'identityVerified' | 'auditFlags' | 'communityVotes',
    number
  >;
}

// ── Ledger ─────────────────────────────────────────────────────────────────

export type LedgerKind = 'pledge' | 'draw' | 'expense' | 'refund' | 'return';
export type LedgerFlag = 'none' | 'info' | 'caution' | 'anomaly';
export type ChainStatus = 'verified' | 'pending' | 'failed';

export interface LedgerEntry {
  id: string;
  ventureId: string;
  postedAt: string;
  kind: LedgerKind;
  counterpartyLabel: string;
  counterpartyRedacted: boolean;
  amountSar: number;
  balanceSar: number;
  flag: LedgerFlag;
  auditNote: string | null;
}

// ── My Projects ────────────────────────────────────────────────────────────

export interface MyProjectsTabs {
  ideas: readonly VentureSummary[];
  leading: readonly VentureSummary[];
  team: readonly VentureSummary[];
  backed: readonly VentureSummary[];
  applications: readonly VentureSummary[];
}

// ── Founder Portal ─────────────────────────────────────────────────────────

export interface EscrowBalance {
  availableSar: number;
  committedSar: number;
  reservedSar: number;
}

export interface ReturnHistoryEntry {
  id: string;
  paidAt: string;
  amountSar: number;
  forMilestoneId: string;
}

export interface FounderPortalState {
  ventureId: string;
  members: readonly VentureMember[];
  milestonesLocked: boolean;
  escrow: EscrowBalance;
  returnsHistory: readonly ReturnHistoryEntry[];
}

// ── Backer Portal ──────────────────────────────────────────────────────────

export interface BackerMilestoneVote {
  ventureId: string;
  milestoneId: string;
  milestoneTitle: string;
  opensAt: string;
  closesAt: string;
  alreadyVoted: 'pass' | 'fail' | 'hold' | null;
}

export interface BackerReturnEntry {
  id: string;
  paidAt: string;
  amountSar: number;
  ventureName: string;
}

export interface BackerPaymentEntry {
  id: string;
  postedAt: string;
  amountSar: number;
  kind: 'pledge' | 'recurring' | 'refund';
  ventureName: string;
}

// ── Data room ──────────────────────────────────────────────────────────────

export interface DataroomDoc {
  id: string;
  title: string;
  uploadedAt: string;
  sizeKb: number;
}

export interface DataroomAccessLogEntry {
  id: string;
  occurredAt: string;
  viewerHandle: string;
  docTitle: string;
}

// ── Cap table ──────────────────────────────────────────────────────────────

export interface CaptableRow {
  shareholderHandle: string;
  shareholderDisplayName: string;
  shares: number;
  pct: number;
  isSelf: boolean;
}

// ── Meetings ───────────────────────────────────────────────────────────────

export interface Meeting {
  id: string;
  title: string;
  startsAt: string;
  agenda: string | null;
  minutes: string | null;
  linkedVoteId: string | null;
}

// ── Backer documents ───────────────────────────────────────────────────────

export type BackerDocKind = 'receipt' | 'terms' | 'zakat' | 'yearly';

export interface BackerDoc {
  id: string;
  kind: BackerDocKind;
  ventureName: string;
  title: string;
  issuedAt: string;
}

// ── Governance ─────────────────────────────────────────────────────────────

export interface CouncilMember {
  handle: string;
  displayName: string;
  termEndsAt: string;
}

export interface Auditor {
  handle: string;
  displayName: string;
  specialty: string;
}

export interface TreasurySnapshot {
  balanceSar: number;
  inflowsMtdSar: number;
  outflowsMtdSar: number;
}

export type DisputeStage =
  | 'filed'
  | 'aiTriage'
  | 'councilReview'
  | 'resolution'
  | 'objection'
  | 'final';

export interface DisputeTimelineEntry {
  id: string;
  stage: DisputeStage;
  occurredAt: string;
  note: string;
}

export interface Dispute {
  id: string;
  ventureId: string;
  ventureName: string;
  filedAt: string;
  currentStage: DisputeStage;
  timeline: readonly DisputeTimelineEntry[];
  evidence: readonly { id: string; title: string; uploadedAt: string }[];
}
