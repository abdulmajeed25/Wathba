import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
export interface ContentWorkspace { id: string; titleAr: string; status: string; role: 'EDITOR' }
type Result<T> = { ok: true; data: T } | { ok: false; status: number };

async function read<T>(path: string): Promise<Result<T>> {
  const token = (await cookies()).get('wathba_session')?.value;
  if (!token) return { ok: false, status: 401 };
  try {
    const res = await fetch(`${API_BASE}/v1/content-workspaces${path}`, {
      cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json() as T };
  } catch { return { ok: false, status: 503 }; }
}

export const listContentWorkspaces = () => read<{ items: ContentWorkspace[] }>('');
export const getContentWorkspace = (id: string) => read<ContentWorkspace>(`/${encodeURIComponent(id)}`);
