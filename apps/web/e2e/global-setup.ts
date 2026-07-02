import { apiSignin } from './helpers';

const API = process.env.E2E_API_URL ?? 'http://localhost:4001';

/**
 * Seeds a deterministic LIVE project with a NO-shipping tier + an OPEN RFQ,
 * so the backer + supplier journeys have stable, self-contained targets.
 * Writes the ids to env for the specs.
 */
export default async function globalSetup(): Promise<void> {
  const token = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const proj = (await fetch(`${API}/v1/projects`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      titleAr: `مشروع E2E ${Date.now()}`,
      shortDescAr: 'هدف اختبار آلي للرحلة الذهبية للداعم',
      category: 'TECH',
      storyAr: 'قصة اختبار آلي طويلة بما يكفي لتجاوز حد المئتي حرف. '.repeat(6),
      fundingGoalHalalas: 100000,
      durationDays: 30,
    }),
  }).then((r) => r.json())) as { id: string };

  await fetch(`${API}/v1/projects/${proj.id}/reward-tiers`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      titleAr: 'باقة رقمية بلا شحن',
      amountHalalas: 5000,
      descAr: 'مكافأة رقمية للاختبار الآلي لا تتطلب شحناً',
      includesPhysicalProduct: false,
      requiresShipping: false,
      estDeliveryDate: '2026-12-01',
    }),
  });
  await fetch(`${API}/v1/projects/${proj.id}/submit`, { method: 'POST', headers: auth });
  await fetch(`${API}/v1/admin/projects/${proj.id}/review`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ decision: 'approve' }),
  });

  const rfq = (await fetch(`${API}/v1/rfqs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      projectId: proj.id,
      specsAr: 'توريد مواد التغليف والشحن لمئة وحدة بمواصفات صديقة للبيئة ومطابقة لمعايير الجودة',
      dueDate: '2026-10-01T00:00:00.000Z',
    }),
  }).then((r) => r.json())) as { id: string };

  // Persist for worker processes via a temp file (portable across CI/local).
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  fs.writeFileSync(
    path.join(os.tmpdir(), 'wathba-e2e-ids.json'),
    JSON.stringify({ projectId: proj.id, rfqId: rfq.id }),
  );
}
