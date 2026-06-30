'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { ApiFaqItem, ApiFaqQuestion } from '@/lib/api/wathba';

export function FaqManager({
  projectId,
  initialItems,
  initialQuestions,
}: {
  projectId: string;
  initialItems: ApiFaqItem[];
  initialQuestions: ApiFaqQuestion[];
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Header
        title="الأسئلة الشائعة"
        subtitle="حرّر بنك الأسئلة الذي يظهر للجمهور، وأجب على ما يصلك من الداعمين."
      />

      <ManageItems projectId={projectId} items={initialItems} />

      <IncomingQuestions projectId={projectId} questions={initialQuestions} />
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }): React.ReactElement {
  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>{title}</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>{subtitle}</p>
    </div>
  );
}

/* ───────────────────────── Manage FAQ items ───────────────────────── */

function ManageItems({
  projectId,
  items,
}: {
  projectId: string;
  items: ApiFaqItem[];
}): React.ReactElement {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle>إدارة الأسئلة الشائعة</SectionTitle>

      <CreateItemCard projectId={projectId} nextOrder={(items[items.length - 1]?.sortOrder ?? 0) + 1} />

      {items.length === 0 ? (
        <Empty>لا توجد أسئلة منشورة بعد.</Empty>
      ) : (
        items.map((it) => <ItemCard key={it.id} projectId={projectId} item={it} />)
      )}
    </section>
  );
}

function CreateItemCard({
  projectId,
  nextOrder,
}: {
  projectId: string;
  nextOrder: number;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sortOrder, setSortOrder] = useState(nextOrder);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setError(null);
    const res = await fetch(`/api/faq/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionAr: question, answerAr: answer, sortOrder }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(`فشل الحفظ (${res.status}): ${(j as { message?: string }).message ?? ''}`);
      return;
    }
    setQuestion('');
    setAnswer('');
    setSortOrder(nextOrder + 1);
    startTransition(() => router.refresh());
  }

  return (
    <Card>
      <CardTitle>إضافة سؤال شائع</CardTitle>
      <Field label="السؤال">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="الإجابة">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          style={textareaStyle}
        />
      </Field>
      <Field label="ترتيب الظهور">
        <input
          type="number"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(Math.max(0, Number(e.target.value)))}
          style={{ ...inputStyle, maxWidth: 120 }}
        />
      </Field>
      {error && <ErrorBanner text={error} />}
      <div>
        <button
          type="button"
          onClick={submit}
          disabled={pending || question.trim().length < 3 || answer.trim().length < 3}
          style={primaryButtonStyle(
            pending || question.trim().length < 3 || answer.trim().length < 3,
          )}
        >
          {pending ? 'جاري الحفظ…' : 'نشر'}
        </button>
      </div>
    </Card>
  );
}

function ItemCard({
  projectId,
  item,
}: {
  projectId: string;
  item: ApiFaqItem;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState(item.questionAr);
  const [a, setA] = useState(item.answerAr);
  const [order, setOrder] = useState(item.sortOrder);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setError(null);
    const res = await fetch(`/api/faq/${projectId}/${item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionAr: q, answerAr: a, sortOrder: order }),
    });
    if (!res.ok) {
      setError(`فشل التحديث (${res.status})`);
      return;
    }
    setEditing(false);
    startTransition(() => router.refresh());
  }

  async function remove(): Promise<void> {
    if (!confirm('حذف هذا السؤال؟')) return;
    const res = await fetch(`/api/faq/${projectId}/${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(`فشل الحذف (${res.status})`);
      return;
    }
    startTransition(() => router.refresh());
  }

  if (editing) {
    return (
      <Card>
        <Field label="السؤال">
          <input value={q} onChange={(e) => setQ(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="الإجابة">
          <textarea value={a} onChange={(e) => setA(e.target.value)} rows={4} style={textareaStyle} />
        </Field>
        <Field label="ترتيب الظهور">
          <input
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(Math.max(0, Number(e.target.value)))}
            style={{ ...inputStyle, maxWidth: 120 }}
          />
        </Field>
        {error && <ErrorBanner text={error} />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={save} disabled={pending} style={primaryButtonStyle(pending)}>
            حفظ
          </button>
          <button type="button" onClick={() => setEditing(false)} style={secondaryButtonStyle()}>
            إلغاء
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary, #5d6b62)', marginBottom: 4 }}>
            ترتيب #{item.sortOrder}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{item.questionAr}</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', lineHeight: 1.7 }}>
            {item.answerAr}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setEditing(true)} style={secondaryButtonStyle()}>
            تحرير
          </button>
          <button type="button" onClick={remove} style={dangerButtonStyle(false)}>
            حذف
          </button>
        </div>
      </div>
      {error && <ErrorBanner text={error} />}
    </Card>
  );
}

/* ───────────────────────── Incoming questions ───────────────────────── */

function IncomingQuestions({
  projectId,
  questions,
}: {
  projectId: string;
  questions: ApiFaqQuestion[];
}): React.ReactElement {
  const pending = questions.filter((q) => q.status === 'PENDING');
  const answered = questions.filter((q) => q.status === 'ANSWERED');

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle>أسئلة الداعمين الواردة</SectionTitle>

      {pending.length === 0 && answered.length === 0 ? (
        <Empty>لا أسئلة واردة حالياً.</Empty>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary, #5d6b62)' }}>
                بانتظار الرد ({pending.length})
              </div>
              {pending.map((q) => (
                <QuestionCard key={q.id} projectId={projectId} q={q} />
              ))}
            </div>
          )}

          {answered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary, #5d6b62)' }}>
                مُجاب عنها ({answered.length})
              </div>
              {answered.map((q) => (
                <div
                  key={q.id}
                  style={{
                    padding: 12,
                    background: 'var(--bg-elevated, #fff)',
                    border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
                    borderRadius: 10,
                    fontSize: 13,
                    color: 'var(--text-secondary, #3b4942)',
                  }}
                >
                  {q.bodyAr}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function QuestionCard({
  projectId,
  q,
}: {
  projectId: string;
  q: ApiFaqQuestion;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setError(null);
    const res = await fetch(`/api/faq-questions/${projectId}/${q.id}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answerAr: answer, publish: true }),
    });
    if (!res.ok) {
      setError(`فشل النشر (${res.status})`);
      return;
    }
    setOpen(false);
    setAnswer('');
    startTransition(() => router.refresh());
  }

  return (
    <Card>
      <div style={{ fontSize: 14, marginBottom: 8 }}>{q.bodyAr}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary, #5d6b62)' }}>
        وردت في {new Date(q.createdAt).toLocaleDateString('ar-SA')}
      </div>
      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="اكتب إجابتك… ستُنشَر كبند جديد في الأسئلة الشائعة."
            style={textareaStyle}
          />
          {error && <ErrorBanner text={error} />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={submit}
              disabled={pending || answer.trim().length < 3}
              style={primaryButtonStyle(pending || answer.trim().length < 3)}
            >
              {pending ? 'جاري النشر…' : 'الرد ونشره في الأسئلة'}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={secondaryButtonStyle()}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={() => setOpen(true)} style={primaryButtonStyle(false)}>
            الرد ونشره
          </button>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{children}</h2>;
}

function Empty({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--bg-elevated, #fff)',
        border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
        borderRadius: 12,
        fontSize: 13,
        color: 'var(--text-secondary, #3b4942)',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div style={{ fontSize: 16, fontWeight: 700 }}>{children}</div>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary, #3b4942)', fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ErrorBanner({ text }: { text: string }): React.ReactElement {
  return (
    <div
      style={{
        padding: '8px 12px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 8,
        fontSize: 13,
        color: '#dc2626',
      }}
    >
      {text}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-strong, rgba(18,33,26,0.16))',
  fontSize: 14,
  background: 'var(--bg-base, #fff)',
  fontFamily: 'inherit',
};
const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical' as const,
  lineHeight: 1.6,
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 10,
    border: 'none',
    background: disabled ? '#9ca3af' : 'var(--brand-primary, #05a661)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}
function secondaryButtonStyle(): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 10,
    border: '1px solid var(--border-strong, rgba(18,33,26,0.16))',
    background: 'transparent',
    color: 'var(--text-primary, #16201b)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
function dangerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 10,
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'transparent',
    color: '#dc2626',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}
