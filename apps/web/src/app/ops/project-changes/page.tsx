import Link from 'next/link';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { FilterForm, qs } from '../_lib/filters';
import { ChangeReview } from '../projects/_components/change-requests-panel';
import { changeStatus, type CampaignChangeRow } from '@/lib/projects/change-requests';

export default async function ProjectChangesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;
  const status = sp.status === undefined ? 'SUBMITTED' : sp.status;
  const listHref = (cursor?: string | null) => `/ops/project-changes?${new URLSearchParams({ status, ...(cursor ? { cursor } : {}) }).toString()}`;
  let error = '';
  let rows: Array<CampaignChangeRow & { project: { id: string; titleAr: string } }> = [];
  let nextCursor: string | null = null;
  try {
    const res = await fetch(`${API_BASE}/v1/ops/project-changes${qs({ status, cursor: sp.cursor })}`, { cache: 'no-store', headers: { 'x-ops-token': opsToken } });
    if (!res.ok) error = res.status === 403 ? 'لا تملك صلاحية مراجعة المشاريع.' : 'تعذر تحميل الطلبات؛ أعد المحاولة.';
    else { const data = await res.json(); rows = data.items; nextCursor = data.nextCursor; }
  } catch { error = 'تعذر الاتصال بخدمة الطلبات؛ أعد المحاولة.'; }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-bold">طلبات تغيير الحملات</h1><Link href="/ops/projects" className="text-[#58a6ff] underline">جميع المشاريع</Link></div>
    <p className="text-sm text-[#8b949e]">راجع الطلب مباشرة أو افتح مساحة المشروع للتفاصيل. القبول المبدئي لا يغيّر الهدف أو الموعد.</p>
    <FilterForm fields={[{ kind: 'select', name: 'status', labelAr: 'حالة الطلب', allLabelAr: 'كل الحالات', options: Object.entries(changeStatus).map(([value, labelAr]) => ({ value, labelAr })) }]} values={{ ...sp, status }} />
    {error ? <div role="alert" className="space-y-3"><p>{error}</p><Link href={listHref(sp.cursor)} className="underline">إعادة المحاولة</Link></div> : rows.length === 0 ? <p>لا توجد طلبات مطابقة لهذه الحالة.</p> : <div className="grid gap-4">{rows.map(row => <article key={row.id} className="space-y-3 rounded-lg border border-[#30363d] p-4">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">{row.project.titleAr}</h2><span>{changeStatus[row.status]}</span></div>
      <ChangeReview row={row} />
      <Link href={`/ops/projects/${row.projectId}?tab=changes`} className="inline-block py-2 text-[#58a6ff] underline">فتح مساحة المشروع</Link>
    </article>)}</div>}
    {nextCursor && <Link href={listHref(nextCursor)} className="inline-block rounded border border-[#30363d] px-4 py-3">الطلبات التالية</Link>}
  </div>;
}
