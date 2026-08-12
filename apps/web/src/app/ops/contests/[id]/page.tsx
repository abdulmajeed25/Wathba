import Link from 'next/link';

import { StatusBadge } from '../../_components/badge';
import { StatTile } from '../../_components/stat-tile';
import { API_BASE, requireAdmin, requireOpsSession } from '../../_lib/guard';
import { contestStatusIntent, contestStatusLabel } from '../_components/contest-status';
import { WinnersTable, type WinnerRow } from '../_components/winners-table';

/**
 * OPS-360 Unit 4 — the per-contest OVERSIGHT workspace. Server-first. Fetches
 * GET /v1/ops/contests/:id (winners masked) and, when the project id is known,
 * the immutable audit trail GET /v1/ops/audit/entity/Project/:projectId so an
 * operator can see every governed action that touched the parent project.
 *
 * Read-only: contests are creator-driven; no ops mutations exist yet (stated in
 * the note). If the detail endpoint 404s we degrade to an amber note.
 */

interface ContestDetail {
  id: string;
  projectId: string;
  projectTitleAr: string | null;
  titleAr: string | null;
  status: string;
  entryCount: number;
  winnerCount: number;
  opensAt: string | null;
  closesAt: string | null;
  announcedAt: string | null;
  winners: WinnerRow[];
}

interface AuditRow {
  id: string;
  chainSeq: string;
  actorType: string;
  actorId: string | null;
  action: string;
  riskTier: string | null;
  reason: string | null;
  createdAt: string;
}

function fmtDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
}

function normaliseDetail(raw: unknown): ContestDetail {
  const o = (raw ?? {}) as Record<string, unknown>;
  const winnersRaw = (o.winners ?? o.winnerList ?? []) as unknown[];
  const winners: WinnerRow[] = (Array.isArray(winnersRaw) ? winnersRaw : []).map((w) => {
    const r = w as Record<string, unknown>;
    const backer = (r.backer ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? r.pledgeId ?? backer.id ?? Math.random()),
      backer: {
        id: String(backer.id ?? r.backerId ?? ''),
        name: (backer.name as string) ?? null,
        email: (backer.email as string) ?? null,
      },
      backerNo: (r.backerNo as number) ?? null,
      rank: (r.rank as number) ?? null,
      announced: Boolean(r.announced ?? r.announcedAt),
      announcedAt: (r.announcedAt as string) ?? null,
      prizeTitleAr: (r.prizeTitleAr as string) ?? (r.tierTitleAr as string) ?? null,
    };
  });
  return {
    id: String(o.id ?? ''),
    projectId: String(o.projectId ?? ''),
    projectTitleAr: (o.projectTitleAr as string) ?? null,
    titleAr: (o.titleAr as string) ?? null,
    status: String(o.status ?? ''),
    entryCount: Number(o.entryCount ?? 0),
    winnerCount: Number(o.winnerCount ?? winners.length),
    opensAt: (o.opensAt as string) ?? null,
    closesAt: (o.closesAt as string) ?? null,
    announcedAt: (o.announcedAt as string) ?? null,
    winners,
  };
}

export default async function OpsContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const { id } = await params;

  const opts = { headers: { 'x-ops-token': opsToken }, cache: 'no-store' as const };

  let detail: ContestDetail | null = null;
  let refused = false;
  let missing = false;
  let trail: AuditRow[] = [];

  try {
    const res = await fetch(`${API_BASE}/v1/ops/contests/${encodeURIComponent(id)}`, opts);
    if (res.status === 403) refused = true;
    else if (res.status === 404) missing = true;
    else if (res.ok) detail = normaliseDetail(await res.json());
  } catch {
    /* API unreachable — states render below */
  }

  if (detail?.projectId) {
    try {
      const r = await fetch(
        `${API_BASE}/v1/ops/audit/entity/Project/${detail.projectId}?limit=50`,
        opts,
      );
      if (r.ok) trail = ((await r.json()) as { items: AuditRow[] }).items;
    } catch {
      /* trail is optional — omitted on failure */
    }
  }

  const back = (
    <Link href="/ops/contests" className="text-sm text-[#58a6ff] hover:underline">
      ← كل المسابقات
    </Link>
  );

  if (refused) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">المسابقة</h1>
          {back}
        </div>
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية عرض المسابقات — اطلبها من المالك.
        </p>
      </div>
    );
  }

  if (missing || !detail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">المسابقة</h1>
          {back}
        </div>
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {missing
            ? 'قيد الإنشاء — نقطة GET /v1/ops/contests/:id لم تُنشر بعد (أو المسابقة غير موجودة).'
            : 'تعذّر تحميل المسابقة (الخادم غير متاح).'}
        </p>
      </div>
    );
  }

  const d = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold">{d.titleAr ?? 'مسابقة'}</h1>
            <StatusBadge intent={contestStatusIntent(d.status)}>
              {contestStatusLabel(d.status)}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm text-[#8b949e]">
            المشروع:{' '}
            {d.projectId ? (
              <Link href={`/ops/projects/${d.projectId}`} className="text-[#58a6ff] hover:underline">
                {d.projectTitleAr ?? d.projectId.slice(0, 8) + '…'}
              </Link>
            ) : (
              '—'
            )}
          </p>
        </div>
        {back}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="المشاركات" value={d.entryCount.toLocaleString('ar-SA-u-nu-latn')} />
        <StatTile label="الفائزون" value={d.winnerCount.toLocaleString('ar-SA-u-nu-latn')} />
        <StatTile
          label="الإغلاق"
          value={<span className="text-sm font-normal">{d.closesAt ? fmtDate(d.closesAt) : '—'}</span>}
        />
        <StatTile
          label="إعلان النتائج"
          value={
            <span className="text-sm font-normal">
              {d.announcedAt ? fmtDate(d.announcedAt) : 'لم يُعلن'}
            </span>
          }
          intent={d.announcedAt ? 'ok' : 'default'}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[#8b949e]">الفائزون (مُقنَّع)</h2>
        <p className="text-xs text-[#8b949e]">
          هوية الفائزين مُقنَّعة من الخادم — لا PII خام. صدِّر CSV من شريط الأدوات.
        </p>
        <WinnersTable rows={d.winners} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[#8b949e]">
          الخط الزمني للمشروع الأمّ{' '}
          <Link
            href={`/ops/audit?entity=Project&entityId=${d.projectId}`}
            className="text-[11px] font-normal text-[#58a6ff] hover:underline"
          >
            فتح في سجل التدقيق ←
          </Link>
        </h2>
        {trail.length === 0 ? (
          <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-6 text-center text-sm text-[#8b949e]">
            لا قيود تدقيق لهذا المشروع بعد
          </p>
        ) : (
          <ol className="space-y-2">
            {trail.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm"
              >
                <span className="tabular-nums text-[#484f58]">#{r.chainSeq}</span>
                <span className="whitespace-nowrap text-xs text-[#8b949e]">{fmtDate(r.createdAt)}</span>
                <code className="font-mono text-xs text-[#e6edf3]">{r.action}</code>
                {r.riskTier ? <StatusBadge intent="muted">{r.riskTier}</StatusBadge> : null}
                <span className="text-xs text-[#8b949e]">{r.actorType}</span>
                {r.reason ? (
                  <span className="basis-full text-xs text-[#8b949e]">— {r.reason}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="rounded border border-[#21262d] bg-[#0d1117] px-3 py-2.5 text-[11px] text-[#484f58]">
        ملاحظة: المسابقات يديرها أصحاب المشاريع — لا توجد عمليات إدارية عليها بعد. هذه الشاشة للرقابة
        والملاحظة فقط.
      </p>
    </div>
  );
}
