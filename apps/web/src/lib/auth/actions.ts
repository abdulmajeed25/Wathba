'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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

interface AuthResponse {
  accessToken: string;
  user: Record<string, unknown>;
}

async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    /* JWT default TTL on apps/api is ~7d; the cookie outlives a single
     * navigation pair, then middleware re-checks on every protected hit. */
    maxAge: 60 * 60 * 24 * 7,
  });
}

async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) redirect('/sign-in?err=missing');

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
      redirect(`/sign-in?err=${errKey}`);
    }
    body = (await res.json()) as AuthResponse;
  } catch {
    redirect('/sign-in?err=network');
  }

  if (!body?.accessToken) redirect('/sign-in?err=server');
  await setSessionCookie(body.accessToken);
  redirect('/projects');
}

export async function signUpAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!name || !email || !password) redirect('/sign-up?err=missing');

  let body: AuthResponse | null = null;
  try {
    const res = await fetch(`${API_BASE}/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const errKey = res.status === 409 ? 'taken' : res.status === 400 ? 'invalid' : 'server';
      redirect(`/sign-up?err=${errKey}`);
    }
    body = (await res.json()) as AuthResponse;
  } catch {
    redirect('/sign-up?err=network');
  }

  if (!body?.accessToken) redirect('/sign-up?err=server');
  await setSessionCookie(body.accessToken);
  redirect('/projects');
}

export async function signOutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/sign-in');
}
