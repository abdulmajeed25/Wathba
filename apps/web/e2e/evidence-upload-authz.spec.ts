import { expect, test } from '@playwright/test';

import { API, E2E_PASSWORD, apiSignin, seededIds, signUpAndVerify, uniqueEmail } from './helpers';

/**
 * Only a project's OWNER may mint a presigned PUT into `evidence/`.
 *
 * The endpoint used to ask for nothing but a valid JWT, so any signed-up
 * account could write into the one prefix that is deliberately private —
 * milestone proof and KYC documents, and what a payout is released against.
 * Not a leak (private prefix, UUID keys), but an attacker who can write there
 * is writing into the review queue for money.
 *
 * Owner-only and NOT collaborators on purpose: ProjectCollaborator grants
 * content access (updates + FAQ), and money and lifecycle stay owner-only
 * (CREATOR-NO-MONEY). Milestone evidence is money.
 *
 * A1 is the one that matters, and it carries a CONTROL: the same stranger
 * asking for a `story` URL must still get 201. Without that, an endpoint that
 * had simply broken and 403'd everything would satisfy this test perfectly —
 * which is the failure mode this whole area keeps producing.
 */

async function presign(token: string, body: Record<string, unknown>): Promise<number> {
  const res = await fetch(`${API}/v1/media/upload-url`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.status;
}

const PDF = { mimeType: 'application/pdf', sizeBytes: 2048 };

test('A1: a stranger cannot presign evidence for a project they do not own', async ({ page }) => {
  const { projectId } = seededIds();

  // A brand-new account, so "not the owner" is guaranteed rather than assumed.
  const email = uniqueEmail('evidence-authz');
  await signUpAndVerify(page, 'فاحص الصلاحيات', email, '1010101010');
  const stranger = await apiSignin(email, E2E_PASSWORD);

  expect(await presign(stranger, { kind: 'evidence', projectId, ...PDF })).toBe(403);

  // CONTROL — the same token, a kind that is the caller's own to write.
  // If this is not 201, the 403 above says nothing about authorization.
  expect(await presign(stranger, { kind: 'story', mimeType: 'image/png', sizeBytes: 2048 })).toBe(201);
});

test('A2: evidence without a projectId is refused, so the check cannot be skipped', async ({ page }) => {
  const email = uniqueEmail('evidence-authz-noproj');
  await signUpAndVerify(page, 'فاحص بلا مشروع', email, '1010101011');
  const stranger = await apiSignin(email, E2E_PASSWORD);

  // Omitting the field must not fall through to "allowed" — that is the
  // obvious way to reintroduce the hole while keeping A1 green.
  expect(await presign(stranger, { kind: 'evidence', ...PDF })).toBe(400);

  // An unknown project id is 403, not 404: the response must not reveal which
  // project ids exist.
  expect(
    await presign(stranger, { kind: 'evidence', projectId: '00000000-0000-4000-8000-000000000000', ...PDF }),
  ).toBe(403);
});
