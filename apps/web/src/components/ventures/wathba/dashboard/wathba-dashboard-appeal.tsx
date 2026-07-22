'use client';

import { useEffect, useState } from 'react';

import { AppealForm, type MyAppeal } from '@/app/appeal/appeal-form';

/**
 * OPS-GAPS R1 — the creator-facing «تقديم تظلّم» section for a REJECTED project.
 * Shown on the dashboard overview only when the project's status is REJECTED.
 * Fetches /api/appeals/mine (bearer via BFF) to seed any existing appeal, then
 * hands off to the shared <AppealForm> (POST /v1/appeals, PROJECT_REJECTION).
 */
export function ProjectRejectionAppeal({
  projectId,
  reviewFeedback,
}: {
  projectId: string;
  reviewFeedback?: string | null;
}) {
  const [existing, setExisting] = useState<MyAppeal | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/appeals/mine');
        if (r.ok) {
          const body = (await r.json()) as { items?: MyAppeal[] } | MyAppeal[];
          const items = Array.isArray(body) ? body : (body.items ?? []);
          const hit = items.find(
            (a) => a.subjectId === projectId && a.kind === 'PROJECT_REJECTION',
          );
          if (alive && hit) setExisting(hit);
        }
      } catch {
        /* endpoint building / offline — form still renders */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <section
      style={{
        marginBottom: 24,
        border: '1px solid rgba(220,38,38,0.35)',
        background: 'rgba(220,38,38,0.05)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 6, color: '#b91c1c' }}>
        رُفض هذا المشروع في المراجعة
      </h2>
      {reviewFeedback ? (
        <p style={{ fontSize: 14, color: '#7f1d1d', margin: 0, marginBottom: 12 }}>
          ملاحظات المراجعة: {reviewFeedback}
        </p>
      ) : null}
      <p style={{ fontSize: 13, color: '#5d6b62', margin: 0, marginBottom: 16 }}>
        إن كنت ترى أن القرار غير صحيح، يمكنك تقديم تظلّم واحد ليعيد فريق العمليات النظر فيه.
      </p>
      {loaded ? (
        <AppealForm
          kind="PROJECT_REJECTION"
          subjectId={projectId}
          kindLabelAr="رفض المشروع"
          existing={existing}
        />
      ) : (
        <p style={{ fontSize: 13, color: '#5d6b62', margin: 0 }}>جارٍ التحميل…</p>
      )}
    </section>
  );
}
