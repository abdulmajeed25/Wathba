'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiProjectDetail } from '@/lib/api/wathba';
import styles from './campaign-change-requests.module.css';
import { changeStatus, type CampaignChangeRow } from '@/lib/projects/change-requests';
const money = (halalas: string | number) => (Number(halalas) / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });

export function CampaignChangeRequests({ project }: { project: ApiProjectDetail }) {
  const [rows, setRows] = useState<CampaignChangeRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState(String(project.fundingGoalHalalas / 100));
  const [days, setDays] = useState(String(project.durationDays));
  const [reason, setReason] = useState('');
  const attempt = useRef<{ key: string; payload: string } | null>(null);
  const endpoint = `/api/project-changes/${project.id}`;
  const load = useCallback(async (cursor?: string) => {
    setLoading(true); setLoadError('');
    try {
      const res = await fetch(endpoint + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'تعذر تحميل الطلبات');
      setRows(old => cursor ? [...old, ...data.items.filter((row: CampaignChangeRow) => !old.some(item => item.id === row.id))] : data.items);
      setNextCursor(data.nextCursor);
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'تعذر تحميل الطلبات'); }
    finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);

  const goalParts = /^(\d{1,14})(?:\.(\d{1,2}))?$/.exec(goal);
  const exactAmount = goalParts ? BigInt(goalParts[1]!) * 100n + BigInt((goalParts[2] ?? '').padEnd(2, '0')) : 0n;
  const amount = Number(exactAmount);
  const duration = Number(days);
  const valid = !!goalParts && exactAmount <= BigInt(Number.MAX_SAFE_INTEGER) && amount > 0 && /^\d+$/.test(days) && duration > 0 && duration <= 36500;
  const proposedDeadline = project.publishedAt && valid ? new Date(new Date(project.publishedAt).getTime() + duration * 86400000) : null;
  const releaseMinimum = valid ? (exactAmount * BigInt(project.releaseThresholdPct) + 99n) / 100n : 0n;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError(''); setMessage('');
    const payload = JSON.stringify({ fundingGoalHalalas: amount, durationDays: duration, reasonAr: reason.trim() });
    if (!attempt.current || attempt.current.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...JSON.parse(payload), clientRequestId: attempt.current.key }) });
      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join('، ') : data.message ?? 'تعذر إرسال الطلب');
      setMessage('حُفظ طلبك وأُرسل للمراجعة. الهدف والموعد الحاليان لم يتغيرا.');
      setRows(old => [data, ...old.filter(row => row.id !== data.id)]);
      setReason(''); attempt.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر الإرسال؛ حاول مجددًا'); }
    finally { setBusy(false); }
  }
  async function withdraw(id: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await fetch(`${endpoint}/${id}/withdraw`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'تعذر سحب الطلب');
      setRows(old => old.map(row => row.id === id ? { ...row, status: 'WITHDRAWN' } : row));
      setMessage('تم سحب الطلب دون تعديل شروط الحملة.');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر سحب الطلب'); }
    finally { setBusy(false); }
  }
  return <section className={styles.panel} aria-labelledby="campaign-change-title">
    <div><p className={styles.eyebrow}>التغييرات والقرارات</p><h2 id="campaign-change-title">طلب تغيير الهدف أو المدة</h2>
      <p>اقترح التغيير ووضّح سببه. القبول المبدئي يفتح التجهيز؛ التطبيق ينتظر موافقات الداعمين المتأثرين وجاهزية التنفيذ. مسار التطبيق لم يُفعّل بعد.</p></div>
    <form onSubmit={submit} className={styles.form}>
      <div className={styles.fields}>
        <label>الهدف المقترح بالريال<input required inputMode="decimal" value={goal} onChange={e => setGoal(e.target.value)} /></label>
        <label>مدة جمع التمويل من تاريخ النشر، بالأيام<input required type="number" min="1" max="36500" value={days} onChange={e => setDays(e.target.value)} /></label>
      </div>
      <p>هذه مدة جمع التمويل وليست عمر تنفيذ المشروع. يمكنك اقتراح مدة طويلة؛ حفظ الطلب لا يعني توفر وسيلة دفع تدعمها.</p>
      {valid && <dl className={styles.preview}>
        <div><dt>الهدف الحالي ← المقترح</dt><dd>{money(project.fundingGoalHalalas)} ← {money(amount)}</dd></div>
        <div><dt>المدة الحالية ← المقترحة</dt><dd>{project.durationDays} ← {duration} يومًا</dd></div>
        {proposedDeadline && <div><dt>موعد الإغلاق التقديري</dt><dd>{proposedDeadline.toLocaleDateString('ar-SA', { dateStyle: 'long', calendar: 'gregory' })}</dd></div>}
        <div><dt>عتبة التمويل وفق الهدف المقترح</dt><dd>{money(releaseMinimum.toString())} عند نسبة {project.releaseThresholdPct}٪</dd></div>
      </dl>}
      <p>المتعهد به حاليًا: {money(project.raisedHalalas)}. خفض الهدف قد يغيّر نتيجة التمويل؛ المعاينة لا تحصّل أموالًا ولا تمثل موافقة الداعمين.</p>
      <label>لماذا تطلب التغيير، وما أثره على التنفيذ والداعمين؟<textarea required minLength={20} maxLength={4000} rows={4} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button disabled={busy || !valid || reason.trim().length < 20} type="submit">{busy ? 'جارٍ الحفظ…' : 'إرسال المقترح للمراجعة'}</button>
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status">{message}</p>}
    <h3>سجل طلبات التغيير</h3>
    {loading ? <p role="status">جارٍ تحميل الطلبات…</p> : loadError ? <div role="alert"><p>{loadError}</p><button onClick={() => void load()}>إعادة المحاولة</button></div> : rows.length === 0 ? <p>لم ترسل طلب تغيير بعد.</p> : rows.map(row => <article key={row.id} className={styles.request}>
      <strong>{changeStatus[row.status] ?? row.status}</strong>
      <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString('ar-SA', { calendar: 'gregory' })}</time>
      <p>{money(row.before.fundingGoalHalalas)} ← {money(row.proposed.fundingGoalHalalas)} · {row.before.durationDays} ← {row.proposed.durationDays} يومًا</p>
      <p>{row.reasonAr}</p>
      {row.reviewNoteAr && <p><strong>رد الإدارة: </strong>{row.reviewNoteAr}</p>}
      {['SUBMITTED', 'ACCEPTED_FOR_PREPARATION', 'CONSENT_OPEN'].includes(row.status) && <button type="button" disabled={busy} onClick={() => void withdraw(row.id)}>سحب الطلب</button>}
    </article>)}
    {nextCursor && !loading && !loadError && <button type="button" onClick={() => void load(nextCursor)}>طلبات أقدم</button>}
  </section>;
}
