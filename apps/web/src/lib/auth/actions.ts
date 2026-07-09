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

/**
 * STAKES/S-12 F-17 — session-length choice: "تذكرني" keeps the 30-day
 * persistent cookies; unchecked issues SESSION cookies (die with the
 * browser). Server-side refresh-token expiry is unchanged either way.
 */
async function setSessionCookie(
  token: string,
  refreshToken?: string,
  opts: { remember?: boolean } = {},
): Promise<void> {
  const store = await cookies();
  const persist = opts.remember !== false; // default: remember (existing flows)
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    /* Access JWT is short-lived (1h on apps/api since Sprint 2); middleware
     * rotates it via the refresh cookie before it lapses. */
    ...(persist ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
  if (refreshToken) {
    store.set({
      name: REFRESH_COOKIE,
      value: refreshToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      ...(persist ? { maxAge: 60 * 60 * 24 * 30 } : {}),
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

/**
 * STAKES/O1 — fire-and-forget server-side product event. Auth events carry
 * the user via the bearer (JWT → userId at the API); nothing identifying
 * beyond that is sent (no IP/UA columns exist server-side).
 */
async function trackEvent(
  name: string,
  token?: string | null,
  props: Record<string, unknown> = {},
): Promise<void> {
  try {
    await fetch(`${API_BASE}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ name, props }),
      cache: 'no-store',
    });
  } catch {
    /* analytics must never break an auth flow */
  }
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

  // redirect() throws NEXT_REDIRECT — keep it OUTSIDE the try (see signUpAction).
  let body: AuthResponse | null = null;
  let status = 0;
  let retryAfterSec = 0;
  try {
    const res = await fetch(`${API_BASE}/v1/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    status = res.status;
    if (res.ok) {
      body = (await res.json()) as AuthResponse;
    } else if (status === 429) {
      // STAKES/A9 P2 — the per-email lockout carries a dynamic Retry-After.
      const err = (await res.json().catch(() => null)) as { retryAfter?: number } | null;
      retryAfterSec = Math.max(0, Number(err?.retryAfter ?? 0));
    }
  } catch {
    redirect(`/sign-in?err=network&next=${encodeURIComponent(next)}`);
  }
  if (status === 429) {
    const wait = retryAfterSec > 0 ? `&wait=${retryAfterSec}` : '';
    redirect(`/sign-in?err=locked${wait}&next=${encodeURIComponent(next)}`);
  }
  if (status < 200 || status >= 300) {
    const errKey = status === 401 ? 'invalid' : 'server';
    redirect(`/sign-in?err=${errKey}&next=${encodeURIComponent(next)}`);
  }

  if (!body?.accessToken) redirect(`/sign-in?err=server&next=${encodeURIComponent(next)}`);
  // STAKES/S-12 F-17 — unchecked "تذكرني" → browser-session cookies only.
  await setSessionCookie(body.accessToken, body.refreshToken, {
    remember: formData.get('remember') === 'on',
  });

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
  //
  // STAKES/S-12 F-11 — the API is now 2xx-UNIFORM: duplicates and new
  // accounts both come back {ok:true}, and the session is minted when the
  // emailed verification link is consumed. No cookies are set here.
  let status = 0;
  try {
    const res = await fetch(`${API_BASE}/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, password, acceptTerms,
        ...(next !== '/projects' ? { next } : {}),
        // STAKES/S-14 P3 — Turnstile implicit-render field (empty when the slot is off).
        ...(formData.get('cf-turnstile-response') ? { captchaToken: String(formData.get('cf-turnstile-response')) } : {}),
      }),
      cache: 'no-store',
    });
    status = res.status;
  } catch {
    redirect(`/sign-up?err=network&next=${encodeURIComponent(next)}`);
  }
  if (status < 200 || status >= 300) {
    const errKey = status === 400 ? 'invalid' : status === 429 ? 'throttle' : 'server';
    redirect(`/sign-up?err=${errKey}&next=${encodeURIComponent(next)}`);
  }

  // Uniform landing for BOTH paths — the enumeration channel stays closed.
  redirect(`/verify-email?sent=1&email=${encodeURIComponent(maskEmailForUi(email))}`);
}

/** Mask for the "check your inbox" screen — never echoes the full address. */
function maskEmailForUi(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * STAKES/S-12 F-11 — consume the emailed verification token. Success mints
 * the session (the link IS the login) and continues into the Nafath step,
 * honoring the deep-link `next` carried through the email.
 */
export async function verifyEmailAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '').trim();
  const next = safeNext(formData.get('next'));
  if (!token) redirect('/verify-email?err=invalid');

  let body: AuthResponse | null = null;
  let status = 0;
  try {
    const res = await fetch(`${API_BASE}/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });
    status = res.status;
    if (res.ok) body = (await res.json()) as AuthResponse;
  } catch {
    redirect('/verify-email?err=network');
  }
  if (!body?.accessToken) {
    redirect(`/verify-email?err=${status === 401 ? 'expired' : 'server'}`);
  }
  await setSessionCookie(body.accessToken, body.refreshToken);
  await trackEvent('signup', body.accessToken); // STAKES/O1 — account activated
  // §8 KYC step — continue to Nafath (the money tier), preserving `next`.
  redirect(`/sign-up/nafath?next=${encodeURIComponent(next)}`);
}

/** STAKES/S-12 F-11 — re-send the link; always lands on the same screen. */
export async function resendVerificationAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  if (email) {
    try {
      await fetch(`${API_BASE}/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        cache: 'no-store',
      });
    } catch {
      /* uniform screen regardless */
    }
  }
  redirect(`/verify-email?sent=1&resent=1&email=${encodeURIComponent(email ? maskEmailForUi(email) : '***')}`);
}

/**
 * §8 Nafath verification — wraps the API's two-step initiate + confirm flow
 * into one server action for the signup wizard. Stub-mode auto-approval makes
 * this complete without a real Nafath integration.
 */
export async function verifyNafathAction(formData: FormData): Promise<void> {
  const nationalId = String(formData.get('nationalId') ?? '').trim();
  // STAKES/A15 — the deep-link target survives the whole signup → Nafath hop.
  const next = safeNext(formData.get('next'));
  const back = `/sign-up/nafath?next=${encodeURIComponent(next)}`;
  if (!/^\d{10}$/.test(nationalId)) redirect(`${back}&err=invalid`);

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) redirect(`/sign-in?next=${encodeURIComponent(back)}`);

  // redirect() throws NEXT_REDIRECT — keep it OUTSIDE the try.
  let failKey: string | null = null;
  try {
    const initRes = await fetch(`${API_BASE}/v1/nafath/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nationalId }),
      cache: 'no-store',
    });
    if (!initRes.ok) {
      failKey = 'server';
    } else {
      const { transactionId } = (await initRes.json()) as { transactionId: string };
      const confirmRes = await fetch(`${API_BASE}/v1/nafath/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transactionId }),
        cache: 'no-store',
      });
      if (!confirmRes.ok) failKey = 'denied';
    }
  } catch {
    failKey = 'network';
  }
  if (failKey) redirect(`${back}&err=${failKey}`);
  await trackEvent('verify', token); // STAKES/O1
  redirect(next);
}

/** Skip the Nafath step for now — user can complete it later from settings. */
export async function skipNafathAction(formData: FormData): Promise<void> {
  // STAKES/A15 — honor the preserved deep-link even when skipping KYC.
  redirect(safeNext(formData.get('next')));
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

/* ── STAKES/S-7 — settings depth (E1 E2 E3 E4 E5) ─────────────────────────── */

async function requireToken(): Promise<string> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/sign-in?next=/projects/settings');
  return token;
}

/** Small helper: POST/PATCH JSON to the API; returns status (0 = network). */
async function apiCall(
  path: string,
  method: string,
  token: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  }
}

/** E1 + A12 — change password; all other sessions revoked server-side. */
export async function changePasswordAction(formData: FormData): Promise<void> {
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (newPassword.length < 8) redirect('/projects/settings?err=pwshort');
  if (newPassword !== confirm) redirect('/projects/settings?err=pwmismatch');
  const token = await requireToken();

  const { status, json } = await apiCall('/v1/users/me/password', 'POST', token, {
    currentPassword,
    newPassword,
  });
  if (status === 0) redirect('/projects/settings?err=network');
  if (status === 401) redirect('/projects/settings?err=badpass');
  if (status < 200 || status >= 300) redirect('/projects/settings?err=server');
  // The API revoked every refresh token and minted us a fresh one.
  const refreshToken = typeof json?.refreshToken === 'string' ? json.refreshToken : undefined;
  if (refreshToken) await setSessionCookie(token, refreshToken);
  redirect('/projects/settings?ok=password');
}

/** E1 — change email (current-password check; generic conflict copy). */
export async function changeEmailAction(formData: FormData): Promise<void> {
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newEmail = String(formData.get('newEmail') ?? '').trim();
  if (!newEmail) redirect('/projects/settings?err=emailmissing');
  const token = await requireToken();

  // STAKES/S-12 F-06 — verify-first: the API sends a confirmation link to the
  // NEW address (2xx-uniform even when taken); nothing changes until the
  // link is clicked, so no token swap happens here anymore.
  const { status } = await apiCall('/v1/users/me/email', 'POST', token, {
    currentPassword,
    newEmail,
  });
  if (status === 0) redirect('/projects/settings?err=network');
  if (status === 401) redirect('/projects/settings?err=badpass');
  if (status < 200 || status >= 300) redirect('/projects/settings?err=server');
  redirect('/projects/settings?ok=emailpending');
}

/** E2 — persist the per-type notification toggles. */
export async function saveNotificationPrefsAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const prefs = {
    projectUpdates: formData.get('projectUpdates') === 'on',
    campaignOutcomes: formData.get('campaignOutcomes') === 'on',
    comments: formData.get('comments') === 'on',
    marketing: formData.get('marketing') === 'on',
  };
  const { status } = await apiCall('/v1/users/me', 'PATCH', token, {
    notificationPrefs: prefs,
  });
  if (status === 0) redirect('/projects/settings?err=network');
  if (status < 200 || status >= 300) redirect('/projects/settings?err=server');
  redirect('/projects/settings?ok=notifs');
}

/** E3 — persist the privacy toggles. */
export async function savePrivacyAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const { status } = await apiCall('/v1/users/me', 'PATCH', token, {
    profilePublic: formData.get('profilePublic') === 'on',
    showBackedCount: formData.get('showBackedCount') === 'on',
  });
  if (status === 0) redirect('/projects/settings?err=network');
  if (status < 200 || status >= 300) redirect('/projects/settings?err=server');
  redirect('/projects/settings?ok=privacy');
}

/** E5 — revoke every refresh token, then drop this device's session too. */
export async function signOutAllAction(): Promise<void> {
  const token = await requireToken();
  await apiCall('/v1/users/me/signout-all', 'POST', token, undefined);
  await clearSessionCookie();
  redirect('/sign-in');
}

/** E4 — PDPL erasure. The UI collects a typed confirmation before this runs. */
export async function deleteAccountAction(formData: FormData): Promise<void> {
  // Server-side re-check of the typed confirmation (defense in depth).
  if (String(formData.get('confirmPhrase') ?? '').trim() !== 'حذف حسابي') {
    redirect('/projects/settings?err=confirm');
  }
  const token = await requireToken();
  const { status } = await apiCall('/v1/users/me', 'DELETE', token, undefined);
  if (status === 0) redirect('/projects/settings?err=network');
  // 409 = money in flight (escrow/active campaign) — surfaced with its own copy.
  if (status === 409) redirect('/projects/settings?err=erase409');
  if (status < 200 || status >= 300) redirect('/projects/settings?err=server');
  await clearSessionCookie();
  // Straight to /projects — bouncing via '/' would nest this action redirect
  // into the root page's own RSC redirect and trip the error boundary.
  redirect('/projects');
}
