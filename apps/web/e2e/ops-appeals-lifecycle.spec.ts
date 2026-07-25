import { expect, test } from '@playwright/test';
import { API, E2E_PASSWORD, apiSignin, opsEnter, signUpAndVerify, uniqueEmail } from './helpers';

/**
 * CLOSEOUT C5 — the appeals lifecycle end-to-end, against the live stack.
 *
 * This is the fairness invariant proved on the real wire rather than in a mock:
 *
 *   operator A bans a user  →  the banned user (whose token grants NO product
 *   access) still reaches /v1/appeals and pleads  →  operator A is REFUSED the
 *   case (four-eyes: you may not judge your own action)  →  a DIFFERENT
 *   operator B claims and OVERTURNS  →  the ban is lifted in the same governed
 *   transaction and the appellant is notified.
 *
 * A is the OWNER (holds '*'); B is the seeded OPS_MANAGER (holds trust.appeals
 * via migration 0056). That B can decide what A may not is the whole point:
 * the permission lets you into the queue, the original-actor exclusion keeps
 * you off your own case.
 *
 * Gated on the golden stack the same way the other ops specs are.
 */

const A = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' }; // bans
const B = { email: 'admin@wathba.demo', pass: 'Wathba!2026' }; // adjudicates

let apiUp = false;
test.beforeAll(async () => {
  try {
    apiUp = (await fetch(`${API}/v1/health`)).ok;
  } catch {
    apiUp = false;
  }
});

interface ExecOut {
  status: number;
  body: { result?: { status?: string; compensation?: string | null }; code?: string; message?: string };
}

/** Execute a registry op as an operator holding a fresh ops session. */
async function exec(opsToken: string, key: string, input: unknown, reason: string): Promise<ExecOut> {
  const r = await fetch(`${API}/v1/ops/operations/${key}/execute`, {
    method: 'POST',
    headers: { 'x-ops-token': opsToken, 'content-type': 'application/json' },
    body: JSON.stringify({ input, reason }),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as ExecOut['body'] };
}

test('a banned user appeals; the banning operator is refused; another operator overturns and the user is restored', async ({
  page,
}) => {
  test.skip(!apiUp, 'API unreachable — skipping live appeals-lifecycle spec');
  test.setTimeout(180_000);

  // ── 1. a real, verified account to act against ────────────────────────────
  const email = uniqueEmail('appeal-sub');
  await signUpAndVerify(page, 'متظلّم آلي', email, '1099887766');
  const userJwt = await apiSignin(email, E2E_PASSWORD);
  const me = (await fetch(`${API}/v1/users/me`, {
    headers: { authorization: `Bearer ${userJwt}` },
  }).then((r) => r.json())) as { id: string };
  expect(me.id).toBeTruthy();

  // ── 2. operator A bans them (SENSITIVE, reason forced, audited) ────────────
  const tokenA = await opsEnter(A.email, A.pass);
  const ban = await exec(tokenA, 'moderation.user.ban', { userId: me.id }, 'حظر اختباري آلي لمسار التظلّم');
  expect(ban.status).toBe(200);

  // ── 3. the banned user can still plead — a suspended token, not a wall ─────
  const bannedJwt = await apiSignin(email, E2E_PASSWORD);
  const submit = await fetch(`${API}/v1/appeals`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bannedJwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'ACCOUNT_BAN',
      subjectId: me.id,
      reasonAr: 'أعتقد أن الحظر وقع نتيجة خطأ في التقدير، ولم أخالف الشروط في أي وقت',
    }),
  });
  expect(submit.status).toBe(201);
  const { appealId } = (await submit.json()) as { appealId: string };

  // ── 3b. one live appeal per decision — the second attempt is refused ───────
  const dup = await fetch(`${API}/v1/appeals`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bannedJwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'ACCOUNT_BAN',
      subjectId: me.id,
      reasonAr: 'محاولة ثانية لتقديم التظلّم نفسه للتحقق من منع التكرار في القاعدة',
    }),
  });
  expect(dup.status).toBe(409);

  // ── 4. FOUR EYES — the banning operator may not take their own case ────────
  const selfClaim = await exec(tokenA, 'appeals.claim', { appealId }, 'محاولة استلام تظلّم ضد قراري');
  expect(selfClaim.status).toBeGreaterThanOrEqual(400);
  expect(JSON.stringify(selfClaim.body)).toContain('self-review');

  // ── 5. a DIFFERENT operator claims and overturns ───────────────────────────
  const tokenB = await opsEnter(B.email, B.pass);
  const claim = await exec(tokenB, 'appeals.claim', { appealId }, 'استلام التظلّم للمراجعة');
  expect(claim.status).toBe(200);

  const decide = await exec(
    tokenB,
    'appeals.decide',
    { appealId, outcome: 'OVERTURNED', decisionReason: 'راجعت الحالة ولم أجد ما يبرّر الحظر — يُنقض القرار' },
    'نقض الحظر بعد مراجعة مستقلة',
  );
  expect(decide.status).toBe(200);
  expect(decide.body.result?.status).toBe('OVERTURNED');
  // The compensating reversal rode the same governed transaction.
  expect(decide.body.result?.compensation).toBeTruthy();

  // ── 6. the user is restored — a clean, unsuspended session ─────────────────
  const restored = (await fetch(`${API}/v1/auth/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: E2E_PASSWORD }),
  }).then((r) => r.json())) as { accessToken: string; suspended?: boolean };
  expect(restored.suspended ?? false).toBe(false);

  // ── 7. …and notified, in-platform, with the decision reason readable ───────
  const notifs = (await fetch(`${API}/v1/notifications/me`, {
    headers: { authorization: `Bearer ${restored.accessToken}` },
  }).then((r) => r.json())) as { items?: Array<{ kind: string }> };
  expect((notifs.items ?? []).map((n) => n.kind)).toContain('APPEAL_DECIDED');

  const mine = (await fetch(`${API}/v1/appeals/mine`, {
    headers: { authorization: `Bearer ${restored.accessToken}` },
  }).then((r) => r.json())) as { appeals: Array<{ status: string; decisionReason: string | null }> };
  expect(mine.appeals[0]?.status).toBe('OVERTURNED');
  expect(mine.appeals[0]?.decisionReason).toBeTruthy(); // never a silent wall
});
