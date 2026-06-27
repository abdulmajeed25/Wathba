import type {
  Auditor,
  BackerDoc,
  BackerMilestoneVote,
  BackerPaymentEntry,
  BackerReturnEntry,
  CaptableRow,
  CouncilMember,
  DataroomAccessLogEntry,
  DataroomDoc,
  Dispute,
  EscrowBalance,
  FounderPortalState,
  LedgerEntry,
  Meeting,
  Milestone,
  MyProjectsTabs,
  OpenRole,
  TreasurySnapshot,
  TrustScoreBreakdown,
  VentureDetail,
  VentureMember,
  VentureSector,
  VentureSummary,
  VentureUpdate,
} from './types';

/* Hand-curated ventures fixtures matching the planned api shapes. */

export const FIXTURE_SECTORS: readonly VentureSector[] = [
  { slug: 'tourism', name: 'Tourism' },
  { slug: 'health', name: 'Health' },
  { slug: 'energy', name: 'Energy' },
  { slug: 'logistics', name: 'Logistics' },
  { slug: 'education', name: 'Education' },
  { slug: 'agritech', name: 'AgriTech' },
];

const TEAM_HUDA: VentureMember = {
  handle: 'huda',
  displayName: 'Huda K.',
  role: 'founder',
};
const TEAM_FATIMA: VentureMember = {
  handle: 'fatima',
  displayName: 'Fatima R.',
  role: 'core',
};
const TEAM_AMJAD: VentureMember = {
  handle: 'amjad',
  displayName: 'Amjad H.',
  role: 'core',
};
const TEAM_SARA: VentureMember = {
  handle: 'sara',
  displayName: 'Sara M.',
  role: 'advisor',
};

const VENTURES: VentureSummary[] = [
  {
    id: 'v-asir-routes',
    handle: 'asir-routes',
    name: 'Asir Routes',
    tagline: 'Curated mountain-village trails for visiting Asir.',
    state: 'raising',
    sectors: [{ slug: 'tourism', name: 'Tourism' }],
    raisedSar: 184_000,
    targetSar: 400_000,
    backerCount: 92,
    trustScore: 78,
    impactPct: 62,
    acceptedBackingTypes: ['reward', 'equity', 'strategicSponsor'],
    founderHandle: 'huda',
  },
  {
    id: 'v-rahat-clinics',
    handle: 'rahat-clinics',
    name: 'Rahat Clinics',
    tagline: 'Telehealth + in-person clinics for under-served districts.',
    state: 'active',
    sectors: [{ slug: 'health', name: 'Health' }],
    raisedSar: 1_240_000,
    targetSar: 1_200_000,
    backerCount: 410,
    trustScore: 91,
    impactPct: 84,
    acceptedBackingTypes: ['reward', 'equity', 'royalty'],
    founderHandle: 'fatima',
  },
  {
    id: 'v-greenwatt',
    handle: 'greenwatt',
    name: 'GreenWatt',
    tagline: 'Solar microgrids for industrial zones.',
    state: 'milestoneHold',
    sectors: [{ slug: 'energy', name: 'Energy' }],
    raisedSar: 2_400_000,
    targetSar: 4_000_000,
    backerCount: 220,
    trustScore: 64,
    impactPct: 71,
    acceptedBackingTypes: ['equity', 'royalty'],
    founderHandle: 'amjad',
  },
  {
    id: 'v-najm-logistics',
    handle: 'najm-logistics',
    name: 'Najm Logistics',
    tagline: 'Last-mile + cold-chain in the Eastern Province.',
    state: 'closed',
    sectors: [{ slug: 'logistics', name: 'Logistics' }],
    raisedSar: 560_000,
    targetSar: 600_000,
    backerCount: 140,
    trustScore: 88,
    impactPct: 58,
    acceptedBackingTypes: ['reward', 'royalty'],
    founderHandle: 'sara',
  },
];

export const FIXTURE_VENTURES: readonly VentureSummary[] = VENTURES;

export function findVenture(id: string): VentureSummary | undefined {
  return VENTURES.find((v) => v.id === id || v.handle === id);
}

const MILESTONES_BY_VENTURE: Record<string, Milestone[]> = {
  'v-asir-routes': [
    {
      id: 'm-1',
      number: 1,
      title: 'Trail surveys + village MoUs',
      targetDate: '2026-07-30',
      state: 'active',
      evidenceUrl: null,
      auditComment: null,
      voteOpensAt: null,
      voteClosesAt: null,
    },
    {
      id: 'm-2',
      number: 2,
      title: 'Beta tours with 50 guests',
      targetDate: '2026-10-15',
      state: 'planned',
      evidenceUrl: null,
      auditComment: null,
      voteOpensAt: null,
      voteClosesAt: null,
    },
  ],
  'v-rahat-clinics': [
    {
      id: 'm-1',
      number: 1,
      title: 'First clinic open in Hail',
      targetDate: '2025-12-10',
      state: 'passed',
      evidenceUrl: 'https://example.com/evidence-1',
      auditComment: 'Evidence verified — photos + permits.',
      voteOpensAt: '2025-12-12T00:00:00Z',
      voteClosesAt: '2025-12-19T00:00:00Z',
    },
    {
      id: 'm-2',
      number: 2,
      title: 'Second clinic + telehealth launch',
      targetDate: '2026-06-15',
      state: 'evidence',
      evidenceUrl: 'https://example.com/evidence-2',
      auditComment: 'AI flagged invoice mismatch — manual review pending.',
      voteOpensAt: '2026-06-20T00:00:00Z',
      voteClosesAt: '2026-06-27T00:00:00Z',
    },
  ],
};

const OPEN_ROLES_BY_VENTURE: Record<string, OpenRole[]> = {
  'v-rahat-clinics': [
    {
      id: 'r-1',
      title: 'Telehealth product lead',
      postedAt: '2026-06-01T09:00:00Z',
      applicantCount: 12,
    },
    {
      id: 'r-2',
      title: 'Senior clinical operations',
      postedAt: '2026-06-04T09:00:00Z',
      applicantCount: 4,
    },
  ],
};

const UPDATES_BY_VENTURE: Record<string, VentureUpdate[]> = {
  'v-rahat-clinics': [
    {
      id: 'u-1',
      title: 'Hail clinic — month one numbers',
      body: 'We saw 240 patients in our first month, with 92% reporting they would return.',
      postedAt: '2026-01-15T08:00:00Z',
      authorHandle: 'fatima',
    },
    {
      id: 'u-2',
      title: 'Telehealth pilot — early signal',
      body: 'Pilot results so far suggest a 35% drop in clinic load for routine cases.',
      postedAt: '2026-05-30T18:00:00Z',
      authorHandle: 'fatima',
    },
  ],
};

export function getVentureDetail(id: string): VentureDetail | null {
  const venture = findVenture(id);
  if (!venture) return null;
  return {
    ...venture,
    description: `${venture.name} — ${venture.tagline} Full deck and ledger embedded below.`,
    problemStatement: `${venture.sectors[0]?.name ?? 'The sector'} has a real gap we can close.`,
    solutionStatement: 'Ship the smallest end-to-end thing first and learn from it.',
    marketBlurb: 'KSA-aligned and scoped — V2030 lifts the tide where this venture rides.',
    useOfFunds: 'Team + tooling + pilot rollout. Every line item is in the ledger.',
    team: [TEAM_HUDA, TEAM_FATIMA, TEAM_AMJAD, TEAM_SARA].filter(
      (m) => m.handle === venture.founderHandle || m.role !== 'founder',
    ),
    milestones: MILESTONES_BY_VENTURE[venture.id] ?? [],
    openRoles: OPEN_ROLES_BY_VENTURE[venture.id] ?? [],
    spaceId: venture.state === 'active' ? `space-${venture.handle}` : null,
    updates: UPDATES_BY_VENTURE[venture.id] ?? [],
    v2030Mapping: venture.sectors.map((s) => ({
      sectorSlug: s.slug,
      sectorName: s.name,
      pct: Math.round(venture.impactPct / venture.sectors.length),
    })),
  };
}

// ── Trust ──────────────────────────────────────────────────────────────────

export function getTrustBreakdown(id: string): TrustScoreBreakdown | null {
  const venture = findVenture(id);
  if (!venture) return null;
  return {
    score: venture.trustScore,
    factors: {
      ledgerHealth: Math.min(100, venture.trustScore + 6),
      milestonePace: Math.max(40, venture.trustScore - 4),
      identityVerified: 100,
      auditFlags: Math.max(50, venture.trustScore - 12),
      communityVotes: Math.min(100, venture.trustScore + 2),
    },
  };
}

// ── Ledger ─────────────────────────────────────────────────────────────────

const LEDGER_BY_VENTURE: Record<string, LedgerEntry[]> = {
  'v-rahat-clinics': [
    {
      id: 'l-1',
      ventureId: 'v-rahat-clinics',
      postedAt: '2025-11-01T09:00:00Z',
      kind: 'pledge',
      counterpartyLabel: 'Anonymous backer A',
      counterpartyRedacted: true,
      amountSar: 5_000,
      balanceSar: 5_000,
      flag: 'none',
      auditNote: null,
    },
    {
      id: 'l-2',
      ventureId: 'v-rahat-clinics',
      postedAt: '2025-11-05T09:00:00Z',
      kind: 'pledge',
      counterpartyLabel: 'Saudi Health Fund',
      counterpartyRedacted: false,
      amountSar: 200_000,
      balanceSar: 205_000,
      flag: 'info',
      auditNote: 'Strategic sponsor — public disclosure.',
    },
    {
      id: 'l-3',
      ventureId: 'v-rahat-clinics',
      postedAt: '2025-12-01T09:00:00Z',
      kind: 'expense',
      counterpartyLabel: 'Clinic Lease Co.',
      counterpartyRedacted: false,
      amountSar: 32_000,
      balanceSar: 173_000,
      flag: 'none',
      auditNote: null,
    },
    {
      id: 'l-4',
      ventureId: 'v-rahat-clinics',
      postedAt: '2026-01-20T09:00:00Z',
      kind: 'expense',
      counterpartyLabel: 'Med Supplies',
      counterpartyRedacted: false,
      amountSar: 18_000,
      balanceSar: 155_000,
      flag: 'caution',
      auditNote: 'Invoice missing — flagged for manual reconciliation.',
    },
    {
      id: 'l-5',
      ventureId: 'v-rahat-clinics',
      postedAt: '2026-03-01T09:00:00Z',
      kind: 'draw',
      counterpartyLabel: 'Founder draw',
      counterpartyRedacted: false,
      amountSar: 25_000,
      balanceSar: 130_000,
      flag: 'none',
      auditNote: null,
    },
    {
      id: 'l-6',
      ventureId: 'v-rahat-clinics',
      postedAt: '2026-05-12T09:00:00Z',
      kind: 'return',
      counterpartyLabel: 'Backers — milestone 1 royalty',
      counterpartyRedacted: false,
      amountSar: 12_000,
      balanceSar: 118_000,
      flag: 'none',
      auditNote: null,
    },
  ],
};

export function getLedgerEntries(ventureId: string): readonly LedgerEntry[] {
  return LEDGER_BY_VENTURE[ventureId] ?? [];
}

// ── My Projects ────────────────────────────────────────────────────────────

export const FIXTURE_MY_PROJECTS: MyProjectsTabs = {
  ideas: [],
  leading: VENTURES.filter((v) => v.founderHandle === 'huda'),
  team: VENTURES.filter((v) => v.id === 'v-rahat-clinics'),
  backed: VENTURES.filter((v) => v.id === 'v-rahat-clinics' || v.id === 'v-greenwatt'),
  applications: [],
};

// ── Founder Portal ─────────────────────────────────────────────────────────

export function getFounderPortalState(ventureId: string): FounderPortalState | null {
  const venture = findVenture(ventureId);
  if (!venture) return null;
  const escrow: EscrowBalance = {
    availableSar: 220_000,
    committedSar: 80_000,
    reservedSar: 60_000,
  };
  return {
    ventureId: venture.id,
    members: [TEAM_HUDA, TEAM_FATIMA, TEAM_AMJAD, TEAM_SARA],
    milestonesLocked: venture.state !== 'raising',
    escrow,
    returnsHistory: [
      {
        id: 'rh-1',
        paidAt: '2026-05-12T09:00:00Z',
        amountSar: 12_000,
        forMilestoneId: 'm-1',
      },
    ],
  };
}

// ── Backer Portal ──────────────────────────────────────────────────────────

export const FIXTURE_BACKER_VOTES: readonly BackerMilestoneVote[] = [
  {
    ventureId: 'v-rahat-clinics',
    milestoneId: 'm-2',
    milestoneTitle: 'Second clinic + telehealth launch',
    opensAt: '2026-06-20T00:00:00Z',
    closesAt: '2026-06-27T00:00:00Z',
    alreadyVoted: null,
  },
];

export function getBackerVotes(ventureId: string): readonly BackerMilestoneVote[] {
  return FIXTURE_BACKER_VOTES.filter((v) => v.ventureId === ventureId);
}

export const FIXTURE_BACKER_RETURNS: readonly BackerReturnEntry[] = [
  {
    id: 'br-1',
    paidAt: '2026-05-12T09:00:00Z',
    amountSar: 240,
    ventureName: 'Rahat Clinics',
  },
];

export const FIXTURE_BACKER_PAYMENTS: readonly BackerPaymentEntry[] = [
  {
    id: 'bp-1',
    postedAt: '2025-11-01T09:00:00Z',
    amountSar: 5_000,
    kind: 'pledge',
    ventureName: 'Rahat Clinics',
  },
];

// ── Data room ──────────────────────────────────────────────────────────────

const DATAROOM_DOCS_BY_VENTURE: Record<string, DataroomDoc[]> = {
  'v-rahat-clinics': [
    {
      id: 'd-1',
      title: 'Audited financials (FY25)',
      uploadedAt: '2026-04-10T09:00:00Z',
      sizeKb: 820,
    },
    {
      id: 'd-2',
      title: 'Telehealth pilot results',
      uploadedAt: '2026-05-30T09:00:00Z',
      sizeKb: 540,
    },
  ],
};

export function getDataroomDocs(ventureId: string): readonly DataroomDoc[] {
  return DATAROOM_DOCS_BY_VENTURE[ventureId] ?? [];
}

export function getDataroomAccessLog(ventureId: string): readonly DataroomAccessLogEntry[] {
  if (ventureId !== 'v-rahat-clinics') return [];
  return [
    {
      id: 'al-1',
      occurredAt: '2026-06-10T11:00:00Z',
      viewerHandle: 'sara',
      docTitle: 'Audited financials (FY25)',
    },
  ];
}

// ── Cap table ──────────────────────────────────────────────────────────────

export function getCaptable(ventureId: string): readonly CaptableRow[] {
  if (ventureId !== 'v-rahat-clinics') return [];
  return [
    {
      shareholderHandle: 'fatima',
      shareholderDisplayName: 'Fatima R.',
      shares: 60_000,
      pct: 60,
      isSelf: false,
    },
    {
      shareholderHandle: 'amjad',
      shareholderDisplayName: 'Amjad H.',
      shares: 15_000,
      pct: 15,
      isSelf: false,
    },
    {
      shareholderHandle: 'self',
      shareholderDisplayName: 'You',
      shares: 5_000,
      pct: 5,
      isSelf: true,
    },
    {
      shareholderHandle: 'esop',
      shareholderDisplayName: 'ESOP pool',
      shares: 20_000,
      pct: 20,
      isSelf: false,
    },
  ];
}

// ── Meetings ───────────────────────────────────────────────────────────────

export function getMeetings(ventureId: string): readonly Meeting[] {
  if (ventureId !== 'v-rahat-clinics') return [];
  return [
    {
      id: 'mt-1',
      title: 'AGM — FY25',
      startsAt: '2026-07-15T15:00:00Z',
      agenda: 'FY25 review, milestone re-plan, ESOP refresh.',
      minutes: null,
      linkedVoteId: 'm-2',
    },
    {
      id: 'mt-2',
      title: 'AGM — FY24',
      startsAt: '2025-07-15T15:00:00Z',
      agenda: 'FY24 close, milestone 1 sign-off.',
      minutes: 'Approved milestone 1; appointed Sara M. as auditor.',
      linkedVoteId: 'm-1',
    },
  ];
}

// ── Backer documents ───────────────────────────────────────────────────────

export const FIXTURE_BACKER_DOCS: readonly BackerDoc[] = [
  {
    id: 'bd-1',
    kind: 'receipt',
    ventureName: 'Rahat Clinics',
    title: 'Pledge receipt — Nov 2025',
    issuedAt: '2025-11-01T09:00:00Z',
  },
  {
    id: 'bd-2',
    kind: 'yearly',
    ventureName: 'Rahat Clinics',
    title: 'FY25 yearly statement',
    issuedAt: '2026-01-15T09:00:00Z',
  },
];

// ── Governance ─────────────────────────────────────────────────────────────

export const FIXTURE_COUNCIL: readonly CouncilMember[] = [
  { handle: 'huda', displayName: 'Huda K.', termEndsAt: '2027-03-01' },
  { handle: 'fatima', displayName: 'Fatima R.', termEndsAt: '2026-12-01' },
  { handle: 'amjad', displayName: 'Amjad H.', termEndsAt: '2027-06-01' },
];

export const FIXTURE_AUDITORS: readonly Auditor[] = [
  { handle: 'sara', displayName: 'Sara M.', specialty: 'Health' },
  { handle: 'layla', displayName: 'Layla A.', specialty: 'Operations' },
];

export const FIXTURE_TREASURY: TreasurySnapshot = {
  balanceSar: 12_400_000,
  inflowsMtdSar: 320_000,
  outflowsMtdSar: 180_000,
};

export function getDispute(id: string): Dispute | null {
  if (id !== 'd-1') return null;
  return {
    id: 'd-1',
    ventureId: 'v-greenwatt',
    ventureName: 'GreenWatt',
    filedAt: '2026-05-22T09:00:00Z',
    currentStage: 'councilReview',
    timeline: [
      {
        id: 'dt-1',
        stage: 'filed',
        occurredAt: '2026-05-22T09:00:00Z',
        note: 'Filed by an anonymous backer — milestone delay.',
      },
      {
        id: 'dt-2',
        stage: 'aiTriage',
        occurredAt: '2026-05-22T11:00:00Z',
        note: 'AI: founder responsive; partial evidence.',
      },
      {
        id: 'dt-3',
        stage: 'councilReview',
        occurredAt: '2026-05-25T09:00:00Z',
        note: 'Council convened — review opens 7 days.',
      },
    ],
    evidence: [
      { id: 'de-1', title: 'Original milestone agreement', uploadedAt: '2026-05-22T10:00:00Z' },
      { id: 'de-2', title: 'Delay correspondence', uploadedAt: '2026-05-23T08:00:00Z' },
    ],
  };
}
