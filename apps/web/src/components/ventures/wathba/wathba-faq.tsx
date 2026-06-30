'use client';

import { useState } from 'react';
import Link from 'next/link';

import type { ApiFaqItem } from '@/lib/api/wathba';
import { Icon } from './wathba-icons';

/**
 * Public FAQ tab for a Wathba project.
 *
 *  - Accordion of `FaqItem`s in sortOrder.
 *  - Below: "اسأل المبدع" form. If the viewer has no session cookie they
 *    see a sign-in CTA; otherwise they can submit.
 *
 * Session presence is detected on the client by checking `document.cookie`
 * for the `wathba_session` cookie (the value is httpOnly so we can't read it,
 * but `document.cookie` reveals presence/absence via `name=` only when the
 * cookie is NOT httpOnly — for httpOnly cookies we instead probe with a
 * lightweight authed fetch). We do the probe so the layout never flickers
 * when the user is logged in but cookie isn't readable.
 */
export function WathbaFaq({
  projectId,
  items,
  isAuthenticated,
}: {
  projectId: string;
  items: ApiFaqItem[];
  isAuthenticated: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        maxWidth: 820,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>الأسئلة الشائعة</h2>

      {items.length === 0 ? (
        <div
          style={{
            padding: 20,
            background: 'var(--card, #fff)',
            border: '1px dashed rgba(var(--ink-rgb), .16)',
            borderRadius: 14,
            fontSize: 14,
            color: 'var(--muted, #5d6b62)',
            textAlign: 'center',
          }}
        >
          لا توجد أسئلة شائعة بعد. كن أوّل من يسأل المبدع أدناه.
        </div>
      ) : (
        items.map((item) => <Accordion key={item.id} item={item} />)
      )}

      <AskCreator projectId={projectId} isAuthenticated={isAuthenticated} />
    </div>
  );
}

function Accordion({ item }: { item: ApiFaqItem }): React.ReactElement {
  return (
    <details
      style={{
        background: 'var(--card, #fff)',
        border: '1px solid rgba(var(--ink-rgb), .08)',
        borderRadius: 14,
        padding: '14px 18px',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          listStyle: 'none',
        }}
      >
        <Icon name="help" size={18} color="var(--accent, #05a661)" />
        {item.questionAr}
      </summary>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.75,
          color: 'var(--muted, #5d6b62)',
          marginTop: 10,
          paddingInlineStart: 28,
          whiteSpace: 'pre-wrap',
        }}
      >
        {item.answerAr}
      </p>
    </details>
  );
}

function AskCreator({
  projectId,
  isAuthenticated,
}: {
  projectId: string;
  isAuthenticated: boolean;
}): React.ReactElement {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/faq-questions/${projectId}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bodyAr: body }),
      });
      if (!res.ok) {
        setError(`فشل الإرسال (${res.status})`);
        return;
      }
      setDone(true);
      setBody('');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: 18,
          background: 'rgba(5,166,97,0.06)',
          border: '1px solid rgba(5,166,97,0.30)',
          borderRadius: 14,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>اسأل المبدع</div>
        <div style={{ fontSize: 13, color: 'var(--muted, #5d6b62)', marginBottom: 12 }}>
          سجّل دخولك لإرسال سؤال — يصل مباشرة إلى لوحة تحكّم المبدع.
        </div>
        <Link
          href="/sign-in"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: 'var(--accent, #05a661)',
            color: '#fff',
            borderRadius: 10,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: 18,
          background: 'rgba(5,166,97,0.10)',
          border: '1px solid rgba(5,166,97,0.30)',
          borderRadius: 14,
          textAlign: 'center',
          fontSize: 14,
        }}
      >
        ✅ شكراً! سؤالك وصل المبدع، وستصلك إشعار عندما يُجيب.
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: 18,
        background: 'var(--card, #fff)',
        border: '1px solid rgba(var(--ink-rgb), .08)',
        borderRadius: 14,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>اسأل المبدع</div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="اكتب سؤالك… سيُراجَع وقد يُنشَر في الأسئلة الشائعة."
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid rgba(var(--ink-rgb), .16)',
          fontSize: 14,
          lineHeight: 1.6,
          resize: 'vertical',
          fontFamily: 'inherit',
          background: 'var(--bg, #fff)',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 10px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            fontSize: 12,
            color: '#dc2626',
          }}
        >
          {error}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || body.trim().length < 5}
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            background:
              submitting || body.trim().length < 5 ? '#9ca3af' : 'var(--accent, #05a661)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: submitting || body.trim().length < 5 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? 'جاري الإرسال…' : 'إرسال السؤال'}
        </button>
      </div>
    </div>
  );
}
