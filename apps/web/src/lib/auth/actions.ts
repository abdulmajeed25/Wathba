'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getMe } from '@/lib/api/wathba';
import { destinationFor } from '@/lib/auth/guard';

/**
 * Server actions for the auth surface.  Talk straight to Wathba's NestJS API
 * (`/auth/signin`, `/auth/signup`) and stash the returned bearer in an
 * httpOnly cookie that SSR fetchers + middleware read.
 *
 * The form components live in `/sign-in` and `/sign-up`; both render in pure
 * server-component mode and use these actions as their `<form action>`.
 *
 * Auth-error UX: instead of throwing (which redirects to the framework error
 * boundary), we redirect back to the page with `?err=…` so the form re-renders
 * with an inline Arabic message.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';
const REFRESH_COOKIE = 'wathba_refresh';

interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: Record<string, unknown>;
}

async function setSessionCookie(token: string, refreshToken?: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    /* Access JWT is short-lived (1h on apps/api since Sprint 2); middleware
     * rotates it via the refresh cookie before it lapses. */
    maxAge: 60 * 60 * 24 * 30,
  });
  if (refreshToken) {
    store.set({
      name: REFRESH_COOKIE,
      value: refreshToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    // Best-effort server-side revocation (rotating token, one-time use).
    try {
      await fetch(`${API_BASE}/v1/auth/signout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
        cache: 'no-store',
      });
    } catch {
      /* revocation is best-effort — cookie deletion still logs the browser out */
    }
  }
  store.delete(SESSION_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/** Safe-list redirect targets so a hostile `next=` can't bounce off-site. */
function safeNext(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/projects';
}

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  if (!email || !password) redirect(`/sign-in?err=missing&next=${encodeURIComponent(next)}`);

  let body: AuthResponse | null = null;
  try {
    const res = await fetch(`${API_BASE}/v1/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const errKey = res.status === 401 ? 'invalid' : 'server';
      redirect(`/sign-in?err=${errKey}&next=${encodeURIComponent(next)}`);
    }
    body = (await res.json()) as AuthResponse;
  } catch {
    redirect(`/sign-in?err=network&next=${encodeURIComponent(next)}`);
  }

  if (!body?.accessToken) redirect(`/sign-in?err=server&next=${encodeURIComponent(next)}`);
  await setSessionCookie(body.accessToken, body.refreshToken);

  // STAKES/B1 — route by role & state. An explicit deep-link `next` wins;
  // otherwise ADMIN → admin, creator → dashboard, everyone else → discover home
  // (this replaces the old blanket redirect that dropped every user, including
  // plain backers, onto the creator dashboard).
  const rawNext = formData.get('next');
  const explicit =
    typeof rawNext === 'string' &&
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    rawNext !== '/projects';
  if (explicit) redirect(next);
  const me = await getMe(body.accessToken);
  redirect(me ? destinationFor(me) : '/projects');
}

export async function signUpAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const acceptTerms = formData.get('acceptTerms') === 'on';
  const next = safeNext(formData.get('next'));
  if (!name || !email || !password) redirect(`/sign-up?err=missing&next=${encodeURIComponent(next)}`);
  // PDPL: explicit consent required (also enforced server-side by the API DTO).
  if (!acceptTerms) redirect(`/sign-up?err=consent&next=${encodeURIComponent(next)}`);

  // NOTE: redirect() throws NEXT_REDIRECT — keep it OUTSIDE the try, or the
  // catch relabels every 4xx/5xx as err=network (masked real statuses for
  // months: 409-taken, 400-invalid and 429-throttle all read as "network").
  let body: AuthResponse | null = null;
  let status = 0;
  try {
    const res = await fetch(`${API_BASE}/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, acceptTerms }),
      cache: 'no-store',
    });
    status = res.status;
    if (res.ok) body = (await res.json()) as AuthResponse;
  } catch {
    redirect(`/sign-up?err=network&next=${encodeURIComponent(next)}`);
  }
  if (status < 200 || status >= 300) {
    const errKey =
      status === 409 ? 'taken' : status === 400 ? 'invalid' : status === 429 ? 'throttle' : 'server';
    redirect(`/sign-up?err=${errKey}&next=${encodeURIComponent(next)}`);
  }

  if (!body?.accessToken) redirect(`/sign-up?err=server&next=${encodeURIComponent(next)}`);
  await setSessionCookie(body.accessToken, body.refreshToken);
  // §8 KYC step — go straight to Nafath verification after a fresh signup;
  // the post-Nafath bounce honors the original `next` URL.
  redirect(`/sign-up/nafath?next=${encodeURIComponent(next)}`);
}

/**
 * §8 Nafath verification — wraps the API's two-step initiate + confirm flow
 * into one server action for the signup wizard. Stub-mode auto-approval makes
 * this complete without a real Nafath integration.
 */
export async function verifyNafathAction(formData: FormData): Promise<void> {
  const nationalId = String(formData.get('nationalId') ?? '').trim();
  if (!/^\d{10}$/.test(nationalId)) redirect('/sign-up/nafath?err=invalid');

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/sign-in?next=/sign-up/nafath');

  try {
    const initRes = await fetch(`${API_BASE}/v1/nafath/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nationalId }),
      cache: 'no-store',
    });
    if (!initRes.ok) redirect('/sign-up/nafath?err=server');
    const { transactionId } = (await initRes.json()) as { transactionId: string };

    const confirmRes = await fetch(`${API_BASE}/v1/nafath/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ transactionId }),
      cache: 'no-store',
    });
    if (!confirmRes.ok) redirect('/sign-up/nafath?err=denied');
  } catch {
    redirect('/sign-up/nafath?err=network');
  }
  redirect('/projects');
}

/** Skip the Nafath step for now — user can complete it later from settings. */
export async function skipNafathAction(): Promise<void> {
  redirect('/projects');
}

/** Update name + phone on the current user (Settings → Profile tab). */
const SOCIAL_PLATFORMS = ['x', 'instagram', 'linkedin', 'youtube', 'tiktok'] as const;

export async function updateProfileAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/sign-in');

  const body: Record<string, unknown> = {};
  if (name.length >= 2) body.name = name;
  if (phone && /^\+?\d{8,15}$/.test(phone)) body.phone = phone;

  // STAKES/S-4 — extended identity surface. Empty strings mean "clear".
  const handle = String(formData.get('handle') ?? '').trim();
  if (handle && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,29}$/.test(handle)) body.handle = handle;
  const bioAr = String(formData.get('bioAr') ?? '').trim();
  if (formData.has('bioAr')) body.bioAr = bioAr.slice(0, 600) || null;
  const city = String(formData.get('city') ?? '').trim();
  if (formData.has('city')) body.city = city.slice(0, 80) || null;
  const websiteUrl = String(formData.get('websiteUrl') ?? '').trim();
  if (formData.has('websiteUrl')) {
    body.websiteUrl = /^https?:\/\//.test(websiteUrl) ? websiteUrl : null;
  }
  // Avatar: the client uploader wrote the MinIO publicUrl into a hidden input.
  const avatarUrl = String(formData.get('avatarUrl') ?? '').trim();
  if (formData.has('avatarUrl')) {
    body.avatarUrl = /^https?:\/\//.test(avatarUrl) ? avatarUrl : null;
  }
  // Social links — one optional https URL per fixed platform.
  if (SOCIAL_PLATFORMS.some((k) => formData.has(`social_${k}`))) {
    body.socialLinks = SOCIAL_PLATFORMS.flatMap((platform) => {
      const url = String(formData.get(`social_${platform}`) ?? '').trim();
      return /^https:\/\//.test(url) ? [{ platform, url }] : [];
    });
  }

  // redirect() throws NEXT_REDIRECT — keep it OUTSIDE the try so the catch
  // only ever sees real network failures.
  let status: number;
  try {
    const res = await fetch(`${API_BASE}/v1/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    status = res.status;
  } catch {
    redirect('/projects/settings?err=network');
  }
  // 409 = handle taken/reserved — its own Arabic message on the form.
  if (status === 409) redirect('/projects/settings?err=handle');
  if (status < 200 || status >= 300) redirect('/projects/settings?err=server');
  redirect('/projects/settings?ok=profile');
}

export async function signOutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/sign-in');
}

/** Sprint 3 / P1-206 — request a password-reset link. Always succeeds UX-wise. */
export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) redirect('/forgot-password?err=missing');
  try {
    await fetch(`${API_BASE}/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });
  } catch {
    redirect('/forgot-password?err=network');
  }
  redirect('/forgot-password?ok=1');
}

/** Sprint 3 / P1-206 — consume the one-time token and set a new password. */
export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (!token) redirect('/forgot-password?err=missing');
  if (password.length < 8) redirect(`/reset-password?token=${encodeURIComponent(token)}&err=short`);
  if (password !== confirm) redirect(`/reset-password?token=${encodeURIComponent(token)}&err=mismatch`);
  try {
    const res = await fetch(`${API_BASE}/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
      cache: 'no-store',
    });
    if (!res.ok) redirect(`/reset-password?token=${encodeURIComponent(token)}&err=invalid`);
  } catch {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&err=network`);
  }
  redirect('/sign-in?err=reset_ok');
}
