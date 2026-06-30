import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
const SESSION_COOKIE = 'wathba_session';

/**
 * Creator-side milestones mutation proxy. The dashboard manager calls this
 * with one of three ops; the proxy forwards to the matching `/v1` route on
 * the Wathba API with the user's bearer cookie. We never add a new backend
 * route — every op maps 1:1 to an existing controller handler in
 * `apps/api/src/milestones/milestones.controller.ts`.
 *
 * Body shape:
 *   { op: 'set-plan',       projectId, data: SetMilestonesDto }
 *   { op: 'submit-evidence',projectId, milestoneId, data: SubmitEvidenceDto }
 *   { op: 'add-spend',      projectId, data: CreateSpendLogDto }
 */
export async function POST(req: Request): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'auth required' }, { status: 401 });

  let body: {
    op: 'set-plan' | 'submit-evidence' | 'add-spend';
    projectId: string;
    milestoneId?: string;
    data?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: 'invalid JSON' }, { status: 400 });
  }
  if (!body.projectId) {
    return NextResponse.json({ message: 'projectId required' }, { status: 400 });
  }

  const base = `${API_BASE}/v1/projects/${body.projectId}`;
  let url: string;
  let method: string;
  switch (body.op) {
    case 'set-plan':
      url = `${base}/milestones`;
      method = 'PUT';
      break;
    case 'submit-evidence':
      if (!body.milestoneId) {
        return NextResponse.json({ message: 'milestoneId required' }, { status: 400 });
      }
      url = `${base}/milestones/${body.milestoneId}/evidence`;
      method = 'POST';
      break;
    case 'add-spend':
      url = `${base}/spend-logs`;
      method = 'POST';
      break;
    default:
      return NextResponse.json({ message: 'unknown op' }, { status: 400 });
  }

  try {
    const apiRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body.data ?? {}),
    });
    const text = await apiRes.text();
    return new NextResponse(text, {
      status: apiRes.status,
      headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ message: 'upstream unavailable' }, { status: 502 });
  }
}
