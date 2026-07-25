import { expect, test } from '@playwright/test';
import { API, opsEnter } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS Part 4 — the agent contract against the LIVE stack:
 *  1. Owner creates an agent (token shown once); the token opens the
 *     manifest via x-agent-token.
 *  2. No blind writes: CONTENT execute refused without a fresh matching
 *     dryRun, passes right after one.
 *  3. MONEY execute → hard refusal regardless of role; propose → four-eyes
 *     queue (cleaned up by an owner reject).
 *  4. SENSITIVE execute → propose-only refusal.
 *  5. Disabling the agent kills its token instantly.
 */

test.describe.configure({ mode: 'serial' });

async function createAgent(
  request: import('@playwright/test').APIRequestContext,
  ownerOps: string,
  nameAr: string,
  roleKey: string,
): Promise<{ agentId: string; token: string }> {
  const r = await request.post(`${API}/v1/ops/operations/agents.create/execute`, {
    headers: { 'x-ops-token': ownerOps },
    data: { input: { nameAr, roleKey }, reason: `اختبار آلي: إنشاء وكيل ${roleKey}` },
  });
  expect(r.status()).toBe(200);
  const body = (await r.json()) as { result: { agentId: string; token: string } };
  expect(body.result.token).toMatch(/^wagent_/);
  return body.result;
}

test('agent lifecycle: create → manifest → no-blind-writes → tier walls → kill', async ({ request }) => {
  const ownerOps = await opsEnter(OWNER.email, OWNER.pass);
  const opsHeaders = { 'x-ops-token': ownerOps };
  const stamp = Date.now();

  // OWNER role is structurally refused at creation.
  const ownerAttempt = await request.post(`${API}/v1/ops/operations/agents.create/execute`, {
    headers: opsHeaders,
    data: { input: { nameAr: `وكيل مرفوض ${stamp}`, roleKey: 'OWNER' }, reason: 'اختبار آلي: يجب الرفض' },
  });
  expect(ownerAttempt.status()).toBe(422);
  expect(JSON.stringify(await ownerAttempt.json())).toContain('OWNER');

  const editor = await createAgent(request, ownerOps, `وكيل المحتوى ${stamp}`, 'CONTENT_EDITOR');
  const finance = await createAgent(request, ownerOps, `وكيل المال ${stamp}`, 'FINANCE');
  const editorHeaders = { 'x-agent-token': editor.token };
  const financeHeaders = { 'x-agent-token': finance.token };

  // …and the minted token is NOT in the stored execution result (redacted):
  // the audit feed for agents.create must not contain the raw token.
  const feed = await request.get(`${API}/v1/ops/audit?action=ops.agents.create&limit=5`, {
    headers: opsHeaders,
  });
  expect(JSON.stringify(await feed.json())).not.toContain('wagent_');

  // 1. The manifest opens with the agent token.
  const manifest = await request.get(`${API}/v1/ops/operations`, { headers: editorHeaders });
  expect(manifest.status()).toBe(200);
  expect(((await manifest.json()) as { items: unknown[] }).items.length).toBeGreaterThan(10);

  // 2. No blind writes: execute BEFORE dryRun → refused.
  const cardInput = {
    kind: 'TIP',
    titleAr: `بطاقة وكيل ${stamp}`,
    bodyAr: 'محتوى اختباري أنشأه وكيل تحت عقد الجزء الرابع بعد dryRun مطابق',
  };
  const blind = await request.post(`${API}/v1/ops/operations/content.editorial.card.create/execute`, {
    headers: editorHeaders,
    data: { input: cardInput, reason: 'اختبار آلي: تنفيذ أعمى يجب رفضه' },
  });
  expect(blind.status()).toBe(403);
  expect(JSON.stringify(await blind.json())).toContain('لا تنفيذ أعمى');

  // dryRun with the SAME input licenses the execute.
  const dry = await request.post(`${API}/v1/ops/operations/content.editorial.card.create/dry-run`, {
    headers: editorHeaders,
    data: { input: cardInput },
  });
  expect(dry.status()).toBe(200);
  expect(((await dry.json()) as { ok: boolean }).ok).toBe(true);

  const exec = await request.post(`${API}/v1/ops/operations/content.editorial.card.create/execute`, {
    headers: editorHeaders,
    data: { input: cardInput, reason: 'اختبار آلي: تنفيذ بعد dryRun مطابق' },
  });
  expect(exec.status()).toBe(200);
  const created = (await exec.json()) as { executionId: string; result: { id?: string } };
  expect(created.executionId).toBeTruthy();

  // …and the action is on the chain as actorType=AGENT with the agentId.
  const agentTrail = await request.get(
    `${API}/v1/ops/audit?actorType=AGENT&action=ops.content.editorial.card.create&limit=5`,
    { headers: opsHeaders },
  );
  const trail = (await agentTrail.json()) as { items: Array<{ agentId: string | null }> };
  expect(trail.items.some((r) => r.agentId === editor.agentId)).toBe(true);

  // Cleanup the created card (owner).
  if (created.result?.id) {
    await request.post(`${API}/v1/ops/operations/content.editorial.card.delete/execute`, {
      headers: opsHeaders,
      data: { input: { id: created.result.id }, reason: 'اختبار آلي: تنظيف بطاقة الوكيل' },
    });
  }

  // 3. MONEY: execute → hard refusal (role-independent); propose → queue.
  const moneyExec = await request.post(`${API}/v1/ops/operations/money.payout.disburse/execute`, {
    headers: { ...financeHeaders, 'x-idempotency-key': `agent-money-${stamp}` },
    data: { input: {}, reason: 'اختبار آلي: يجب الرفض الصلب' },
  });
  expect(moneyExec.status()).toBe(403);
  expect(JSON.stringify(await moneyExec.json())).toContain('لا يُنفّذون عمليات مالية');

  const proposal = await request.post(`${API}/v1/ops/operations/money.payout.disburse/propose`, {
    headers: { ...financeHeaders, 'x-idempotency-key': `agent-prop-${stamp}` },
    data: { input: {}, reason: 'اقتراح وكيل مالي: تشغيل دورة الصرف' },
  });
  expect(proposal.status()).toBe(200);
  const prop = (await proposal.json()) as { queued: boolean; proposalId: string };
  expect(prop.queued).toBe(true);

  // An agent can never decide a proposal (human-only guard refuses even auth).
  const agentApprove = await request.post(`${API}/v1/ops/proposals/${prop.proposalId}/approve`, {
    headers: financeHeaders,
    data: { reason: 'محاولة اعتماد من وكيل يجب رفضها' },
  });
  expect(agentApprove.status()).toBe(401);

  // Owner rejects it (cleanup + the human decision path).
  const reject = await request.post(`${API}/v1/ops/proposals/${prop.proposalId}/reject`, {
    headers: opsHeaders,
    data: { reason: 'اختبار آلي: رفض اقتراح الوكيل بعد إثبات المسار' },
  });
  expect(reject.status()).toBe(200);

  // 4. SENSITIVE execute → propose-only refusal (finance agent, users op
  // would also fail permission — use a SENSITIVE op the role could hold).
  const sensitive = await request.post(`${API}/v1/ops/operations/users.pii.unmask/execute`, {
    headers: financeHeaders,
    data: { input: { userId: finance.agentId, fields: ['email'] }, reason: 'اختبار آلي: يجب الرفض' },
  });
  expect(sensitive.status()).toBe(403);
  expect(JSON.stringify(await sensitive.json())).toContain('dryRun واقتراح فقط');

  // 5. Kill: disable both agents → tokens die instantly.
  for (const a of [editor, finance]) {
    const off = await request.post(`${API}/v1/ops/operations/agents.set-active/execute`, {
      headers: opsHeaders,
      data: { input: { agentId: a.agentId, isActive: false }, reason: 'اختبار آلي: تعطيل بعد الاختبار' },
    });
    expect(off.status()).toBe(200);
  }
  const dead = await request.get(`${API}/v1/ops/operations`, { headers: editorHeaders });
  expect(dead.status()).toBe(401);
});

test('«الوكلاء» screen renders with the kill-switch state', async ({ page }) => {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(OWNER.email);
  await page.locator('input[name="password"]').fill(OWNER.pass);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/projects(\?|$|\/)/);

  await page.goto('/ops');
  await page.waitForURL(/\/ops\/enter/);
  await page.locator('#ops-password').fill(OWNER.pass);
  await page.getByRole('button', { name: 'دخول إلى مركز العمليات' }).click();
  await page.waitForURL(/\/ops$/);

  // CLOSEOUT C5 — scope to the sidebar: «الوكلاء» is legitimately also a
  // quick-link on the /ops home, so an unscoped role query is ambiguous.
  await page.getByLabel('أقسام مركز العمليات').getByRole('link', { name: 'الوكلاء' }).click();
  await page.waitForURL(/\/ops\/agents/);
  await expect(page.getByText(/واجهة الوكلاء تعمل|مفتاح الإيقاف الشامل/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'إنشاء وكيل' })).toBeVisible();
});
