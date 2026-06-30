'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Server action behind the /projects/submit wizard.
 *
 *   1. Read the form payload (already client-validated, but trust nothing).
 *   2. POST /v1/projects (creates DRAFT).
 *   3. POST /v1/projects/:id/submit (DRAFT → UNDER_REVIEW).
 *   4. Redirect to the per-project dashboard.
 *
 * Errors bounce back to /projects/submit?err=<code> so the wizard surfaces
 * an inline Arabic message — same pattern as the auth actions.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

interface ApiProject {
  id: string;
  status: string;
}

interface ApiError {
  statusCode?: number;
  message?: string | string[];
}

export async function submitProjectAction(formData: FormData): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect('/sign-in?next=/projects/submit');

  const get = (k: string): string => String(formData.get(k) ?? '').trim();
  const num = (k: string): number => {
    const v = formData.get(k);
    if (v === null || v === '') return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  const body = {
    titleAr: get('titleAr'),
    shortDescAr: get('shortDescAr'),
    category: get('category'),
    storyAr: get('storyAr'),
    fundingGoalHalalas: Math.round(num('fundingGoalSar') * 100),
    releaseThresholdPct: num('releaseThresholdPct') || 80,
    durationDays: num('durationDays'),
    productSpecAr: get('productSpecAr') || undefined,
    expectedDeliveryDate: get('expectedDeliveryDate') || undefined,
  };

  // ── 1) Create DRAFT ─────────────────────────────────────────────────────
  let created: ApiProject;
  try {
    const r = await fetch(`${API_BASE}/v1/projects`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as ApiError;
      const msg = Array.isArray(j.message) ? j.message.join(' · ') : j.message ?? 'create-failed';
      redirect(`/projects/submit?err=${encodeURIComponent(msg)}`);
    }
    created = (await r.json()) as ApiProject;
  } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    redirect('/projects/submit?err=network');
  }

  // ── 2) Submit for review ────────────────────────────────────────────────
  try {
    const r = await fetch(`${API_BASE}/v1/projects/${created.id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!r.ok) {
      // Create succeeded but submit didn't — send them to the project dashboard
      // so they can fix what the server flagged and submit from there.
      const j = (await r.json().catch(() => ({}))) as ApiError;
      const msg = Array.isArray(j.message) ? j.message.join(' · ') : j.message ?? 'submit-failed';
      redirect(`/projects/dashboard/${created.id}/settings?err=${encodeURIComponent(msg)}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    redirect(`/projects/dashboard/${created.id}/settings?err=network`);
  }

  redirect(`/projects/dashboard/${created.id}?ok=submitted`);
}
