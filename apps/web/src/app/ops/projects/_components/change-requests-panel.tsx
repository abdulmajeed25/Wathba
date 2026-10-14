'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OpRunner } from '../../_components/op-runner';
import { formatSar } from '../../_lib/money';
import { changeStatus, type CampaignChangeRow } from '@/lib/projects/change-requests';

type BackerResponse = { id: string; backerNo: number; amountHalalas: string; decision: string | null; respondedAt: string | null; responseCurrent: boolean };
function IndividualResponses({ requestId }: { requestId: string }) {
  const [rows, setRows] = useState<BackerResponse[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load(next?: string) {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/ops/read/project-changes/${requestId}/responses${next ? `?cursor=${next}` : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 403 ? 'لا تملك صلاحية مراجعة الردود' : 'تعذر تحميل الردود؛ أعد المحاولة');
      const data = await res.json();
      setRows(old => next ? [...(old ?? []), ...data.items.filter((r: BackerResponse) => !(old ?? []).some(p => p.id === r.id))] : data.items);
      setCursor(data.nextCursor);
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر الاتصال'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 border-t border-[#30363d] pt-3">
    <button type="button" disabled={busy} onClick={() => void load()} className="min-h-11 underline">{busy ? 'جارٍ تحميل الردود…' : rows ? 'تحديث ردود التعهدات' : 'عرض ردود التعهدات'}</button>
    {error && <p role="alert">{error}</p>}
    {rows && <><p className="text-sm text-[#8b949e]">كل سطر يخص تعهدًا مستقلًا؛ لا تمثل القائمة تصويت أغلبية أو إذنًا بالتطبيق. الرد التاريخي يحتاج مراجعة جديدة عند تغير الشروط أو التعهد.</p>
      {!rows.length && <p>لا توجد تعهدات مؤهلة أو ردود سابقة.</p>}
      <ul className="space-y-2">{rows.map(row => <li key={row.id} className="rounded border border-[#30363d] p-3">
        تعهد رقم {row.backerNo} · {formatSar(row.amountHalalas)} · {row.decision === 'ACCEPT' ? 'موافق' : row.decision === 'DECLINE' ? 'غير موافق' : 'لم يرد'}
        {row.respondedAt && <span> · {new Date(row.respondedAt).toLocaleString('ar-SA-u-ca-gregory')}{!row.responseCurrent && ' · رد تاريخي؛ غير صالح للتطبيق الحالي'}</span>}
      </li>)}</ul>
      {cursor && <button type="button" disabled={busy} onClick={() => void load(cursor)} className="min-h-11 underline">عرض المزيد من التعهدات</button>}
    </>}
  </div>;
}

export function ChangeReview({ row }: { row: CampaignChangeRow }) {
  const [note, setNote] = useState('');
  const router = useRouter();
  return <article className="space-y-3 rounded-lg border border-[#30363d] p-4">
    <strong>{changeStatus[row.status] ?? row.status}</strong>
    <p>الهدف: {formatSar(row.before.fundingGoalHalalas)} ← {formatSar(row.proposed.fundingGoalHalalas)}</p>
    <p>مدة جمع التمويل: {row.before.durationDays} ← {row.proposed.durationDays} يومًا</p>
    <p className="whitespace-pre-wrap break-words">{row.reasonAr}</p>
    {row.reviewNoteAr && <p>رد الإدارة: {row.reviewNoteAr}</p>}
    {row.status === 'ACCEPTED_FOR_PREPARATION' && <OpRunner opKey="projects.changes.open-consent" input={{ projectId: row.projectId, requestId: row.id }} triggerLabel="معاينة فتح الرد للداعمين" riskTier="SENSITIVE" requiresReason onDone={() => router.refresh()} />}
    {['CONSENT_OPEN', 'WITHDRAWN'].includes(row.status) && <IndividualResponses requestId={row.id} />}
    {row.status === 'SUBMITTED' && <>
      <label className="block space-y-2"><span>الرد الذي سيظهر لصاحب الحملة</span>
        <textarea rows={3} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} className="w-full rounded border border-[#30363d] bg-[#0d1117] p-3" />
      </label>
      <div className="flex flex-wrap gap-3">
        <OpRunner opKey="projects.changes.review" input={{ projectId: row.projectId, requestId: row.id, decision: 'accept', noteAr: note.trim() }} disabled={note.trim().length < 10} triggerLabel="معاينة القبول المبدئي" riskTier="SENSITIVE" requiresReason onDone={() => router.refresh()} />
        <OpRunner opKey="projects.changes.review" input={{ projectId: row.projectId, requestId: row.id, decision: 'reject', noteAr: note.trim() }} disabled={note.trim().length < 10} triggerLabel="معاينة الرفض" variant="danger" riskTier="SENSITIVE" requiresReason onDone={() => router.refresh()} />
      </div>
    </>}
  </article>;
}

export function ChangeRequestsPanel({ rows }: { rows: CampaignChangeRow[] }) {
  return <section className="space-y-4" aria-labelledby="change-review-heading">
    <h2 id="change-review-heading" className="text-lg font-bold">طلبات تغيير الهدف والمدة</h2>
    <p className="text-sm text-[#8b949e]">هذه مراجعة مبدئية فقط؛ لا تغير شروط الحملة أو تحرك الأموال. التطبيق ينتظر موافقات المتأثرين وجاهزية التنفيذ.</p>
    {rows.length ? rows.map(row => <ChangeReview key={row.id} row={row} />) : <p>لا توجد طلبات تغيير.</p>}
  </section>;
}
