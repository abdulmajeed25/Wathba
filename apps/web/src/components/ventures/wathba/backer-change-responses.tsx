'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { changeStatus } from '@/lib/projects/change-requests';
import styles from './dashboard/campaign-change-requests.module.css';

type Row = {
  id: string; status: string; reasonAr: string; reviewNoteAr: string | null; canRespond: boolean;
  before: { fundingGoalHalalas: string; durationDays: number; deadline: string; releaseThresholdPct: number };
  proposed: { fundingGoalHalalas: string; durationDays: number };
  response: { decision: 'ACCEPT' | 'DECLINE'; createdAt: string } | null;
};
const money = (value: string) => {
  const amount = BigInt(value);
  return `${new Intl.NumberFormat('ar-SA').format(amount / 100n)}٫${String(amount % 100n).padStart(2, '0')} ر.س`;
};
const date = (value: string | number) => new Date(value).toLocaleDateString('ar-SA-u-ca-gregory');

function ResponseCard({ row, pledgeId, onSaved }: { row: Row; pledgeId: string; onSaved: (id: string, response: NonNullable<Row['response']>) => void }) {
  const [choice, setChoice] = useState<'ACCEPT' | 'DECLINE' | ''>('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const attempt = useRef<{ choice: string; key: string } | null>(null);
  const proposedEnd = new Date(row.before.deadline).getTime() + (row.proposed.durationDays - row.before.durationDays) * 86400000;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice || !confirmed || busy) return;
    if (attempt.current?.choice !== choice) attempt.current = { choice, key: crypto.randomUUID() };
    setBusy(true); setError(''); setSaved(false);
    try {
      const res = await fetch(`/api/pledge-changes/${pledgeId}/${row.id}/respond`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision: choice, clientRequestId: attempt.current.key }) });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'تعذر حفظ الرد؛ أعد المحاولة');
      onSaved(row.id, data); setSaved(true); setConfirmed(false); setChoice(''); attempt.current = null;
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر التأكد من حفظ الرد؛ أعد المحاولة'); }
    finally { setBusy(false); }
  }
  return <article className={styles.request}>
    <h2>{changeStatus[row.status] ?? row.status}</h2>
    <dl className={styles.preview}>
      <div><dt>الهدف الحالي ← المقترح</dt><dd>{money(row.before.fundingGoalHalalas)} ← {money(row.proposed.fundingGoalHalalas)}</dd></div>
      <div><dt>مدة جمع التمويل الحالية ← المقترحة</dt><dd>{row.before.durationDays} ← {row.proposed.durationDays} يومًا</dd></div>
      <div><dt>موعد نهاية الجمع الحالي ← المقترح</dt><dd>{date(row.before.deadline)} ← {date(proposedEnd)}</dd></div>
      <div><dt>حد النجاح المالي عند نسبة {row.before.releaseThresholdPct}%</dt><dd>{money(String((BigInt(row.before.fundingGoalHalalas) * BigInt(row.before.releaseThresholdPct) + 99n) / 100n))} ← {money(String((BigInt(row.proposed.fundingGoalHalalas) * BigInt(row.before.releaseThresholdPct) + 99n) / 100n))}</dd></div>
    </dl>
    <p><strong>سبب التغيير: </strong>{row.reasonAr}</p>
    {row.reviewNoteAr && <p><strong>رد الإدارة: </strong>{row.reviewNoteAr}</p>}
    <p>تغيير حد النجاح قد يجعل الحملة تنجح بمبلغ مختلف. تغيير مدة الجمع قد يقدّم قرار النجاح أو يؤخره؛ لا يعني تمديد صلاحية حجز البطاقة أو تغيير موعد تسليم المكافأة تلقائيًا.</p>
    <p>موافقتك تخص هذا التعهد فقط. رفضك أو عدم ردك لا يجيز فرض شروط جديدة عليك، ولا يبدأ استردادًا تلقائيًا. يمكنك تعديل ردك ما دام الطلب مفتوحًا.</p>
    {row.response && <p>آخر رد محفوظ: <strong>{row.response.decision === 'ACCEPT' ? 'أوافق' : 'لا أوافق'}</strong> · {date(row.response.createdAt)}</p>}
    {row.canRespond ? <form onSubmit={submit} className={styles.form}>
      <fieldset disabled={busy} style={{ display: 'grid', gap: 12 }}><legend>قرارك بشأن هذا التعهد</legend>
        {(['ACCEPT', 'DECLINE'] as const).map(value => <label key={value} style={{ display: 'flex', alignItems: 'center' }}><input style={{ width: 20, height: 20 }} type="radio" name={`decision-${row.id}`} value={value} checked={choice === value} onChange={() => { setChoice(value); setConfirmed(false); setSaved(false); }} />{value === 'ACCEPT' ? 'أوافق على التغيير المقترح' : 'لا أوافق على التغيير المقترح'}</label>)}
        <label style={{ display: 'flex', alignItems: 'center' }}><input style={{ width: 20, height: 20 }} type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />راجعت الفرق وأؤكد تسجيل القرار الذي اخترته</label>
      </fieldset>
      <button disabled={busy || !choice || !confirmed} type="submit">{busy ? 'جارٍ حفظ الرد…' : 'حفظ قراري'}</button>
    </form> : <p>الرد غير متاح حاليًا؛ قد يكون الطلب أغلق أو تغيرت حالة الحملة أو تعهدك.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {saved && <p role="status">حُفظ ردك. لم تتغير شروط تعهدك ولم تتحرك أموال.</p>}
  </article>;
}

export function BackerChangeResponses({ pledgeId }: { pledgeId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (next?: string) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/pledge-changes/${pledgeId}${next ? `?cursor=${next}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(res.status === 404 ? 'التعهد غير موجود أو لا تملك الوصول إليه' : typeof data.message === 'string' ? data.message : 'تعذر تحميل الطلبات');
      setRows(old => next ? [...old, ...data.items.filter((row: Row) => !old.some(r => r.id === row.id))] : data.items); setCursor(data.nextCursor);
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر تحميل الطلبات'); }
    finally { setLoading(false); }
  }, [pledgeId]);
  useEffect(() => { void load(); }, [load]);
  return <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 18px 80px' }}>
    <Link href="/projects/me/pledges" style={{ display: 'inline-block', padding: '12px 0', textDecoration: 'underline' }}>العودة إلى تعهداتي</Link>
    <section className={styles.panel} aria-labelledby="backer-changes-heading">
      <span className={styles.eyebrow}>قرارك محفوظ · لكل تعهد على حدة</span><h1 id="backer-changes-heading" style={{ fontSize: '1.8rem', fontWeight: 750 }}>طلبات تغيير شروط الحملة</h1>
      <p>هذه مرحلة جمع الردود الفردية. تطبيق التغيير المالي غير مفعّل بعد، حتى إن وافق جميع الداعمين.</p>
      {error && <div role="alert"><p className={styles.error}>{error}</p><button onClick={() => void load(cursor ?? undefined)} disabled={loading}>إعادة المحاولة</button></div>}
      {loading && <p role="status">جارٍ تحميل الطلبات…</p>}
      {!loading && !error && !rows.length && <p>لا توجد طلبات تغيير مطروحة لهذا التعهد.</p>}
      {rows.map(row => <ResponseCard key={row.id} row={row} pledgeId={pledgeId} onSaved={(id, response) => setRows(old => old.map(r => r.id === id ? { ...r, response } : r))} />)}
      {cursor && <button disabled={loading} onClick={() => void load(cursor)}>عرض الطلبات الأقدم</button>}
    </section>
  </div>;
}
