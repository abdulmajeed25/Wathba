import Constants from 'expo-constants';

const DEFAULT_BASE_URL = 'http://localhost:4000';

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
}

export async function api<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { json, headers, ...rest } = opts;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'accept-language': 'ar',
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
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
