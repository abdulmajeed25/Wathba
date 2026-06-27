import Constants from 'expo-constants';
import { useAuthStore } from '../auth/store';

const DEFAULT_BASE_URL = 'http://localhost:4000/v1';

function resolveBaseUrl(): string {
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.apiBaseUrl;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  if (process.env.EXPO_PUBLIC_API_BASE_URL) return process.env.EXPO_PUBLIC_API_BASE_URL;
  return DEFAULT_BASE_URL;
}

export const API_BASE_URL = resolveBaseUrl();

export interface FetchOptions extends RequestInit {
  json?: unknown;
  /** If false, don't attach the bearer token even when authenticated. */
  auth?: boolean;
}

export async function api<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { json, headers, auth = true, ...rest } = opts;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const token = auth ? useAuthStore.getState().token : null;
  const res = await fetch(url, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'accept-language': 'ar',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    throw new ApiError(res.status, detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
