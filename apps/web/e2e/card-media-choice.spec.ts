import { expect, test } from '@playwright/test';

import { API, apiSignin, seededIds } from './helpers';

/**
 * The creator owns what their CARD shows — migration 0060.
 *
 * Three states, and the third is the one that did not exist before:
 *
 *   no video                → cover only
 *   video + cardMedia VIDEO → plays on hover  (the default)
 *   video + cardMedia POSTER→ cover only, and the campaign page still plays it
 *
 * The choice is resolved SERVER-SIDE, on the card payloads, so these assertions
 * are made against the API rather than against four components: hero, trending
 * and the two magazine carousels all render whatever `videoUrl` they are given,
 * and the point of resolving it once is that they cannot disagree. What the
 * browser has to prove is the other half — that the DETAIL payload keeps the
 * raw video, because that is what the campaign page plays and what the creator
 * edits.
 *
 * Runs against the golden-journey project: LIVE, owned by smoke-s1, and
 * deliberately not fixture-flagged (it is public on purpose — see
 * batch-polish-fixtures.spec.ts, which asserts the fixture rule it is exempt
 * from). Its state is restored at the end of each test.
 */

const CLIP = 'http://161.97.150.122:9000/venture-evidence/story/2026/08/card-media-spec.mp4';

async function patch(jwt: string, id: string, body: Record<string, unknown>) {
  return fetch(`${API}/v1/projects/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
}

async function detail(jwt: string, id: string) {
  const r = await fetch(`${API}/v1/projects/${id}`, { headers: { authorization: `Bearer ${jwt}` } });
  return r.json() as Promise<{ videoUrl: string | null; cardMedia: string }>;
}

test('CM1: a LIVE creator can change the card media — the pre-launch freeze does not apply', async () => {
  const { projectId } = seededIds();
  const jwt = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');

  // This is the assertion that would have failed before the carve-out. The
  // PATCH endpoint rejects every edit once a project leaves DRAFT/UNDER_REVIEW,
  // which made the setting unusable for exactly the projects it applies to —
  // the ones on the homepage.
  const res = await patch(jwt, projectId, { videoUrl: CLIP, cardMedia: 'VIDEO' });
  expect(res.status, `PATCH on a LIVE project returned ${res.status}`).toBe(200);
  expect((await detail(jwt, projectId)).cardMedia).toBe('VIDEO');

  // And the freeze still holds for everything else.
  const frozen = await patch(jwt, projectId, { fundingGoalHalalas: 5_000_000 });
  expect(frozen.status, 'the funding goal must still be frozen after launch').toBe(400);

  await patch(jwt, projectId, { videoUrl: null, cardMedia: 'VIDEO' });
});

test('CM2: choosing POSTER does not destroy the campaign video', async () => {
  const { projectId } = seededIds();
  const jwt = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');

  await patch(jwt, projectId, { videoUrl: CLIP, cardMedia: 'VIDEO' });
  await patch(jwt, projectId, { cardMedia: 'POSTER' });

  // This is the half that makes the choice a CHOICE rather than a delete: the
  // card stops showing the video, and the project keeps it, so the campaign
  // page still has something to play. The card half is asserted in the API's
  // own card-media.spec.ts — the only LIVE project this suite owns has no cover
  // and so never appears in the discover feed, which means there is no public
  // card payload here to read.
  const d = await detail(jwt, projectId);
  expect(d.videoUrl, 'choosing POSTER must not remove the campaign video').toBe(CLIP);
  expect(d.cardMedia).toBe('POSTER');

  await patch(jwt, projectId, { videoUrl: null, cardMedia: 'VIDEO' });
});

test('CM3: the flag round-trips independently of the video', async () => {
  const { projectId } = seededIds();
  const jwt = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');

  await patch(jwt, projectId, { videoUrl: null, cardMedia: 'POSTER' });
  let d = await detail(jwt, projectId);
  expect(d.cardMedia, 'the choice must be storable before a video exists').toBe('POSTER');
  expect(d.videoUrl).toBeNull();

  await patch(jwt, projectId, { cardMedia: 'VIDEO' });
  d = await detail(jwt, projectId);
  expect(d.cardMedia).toBe('VIDEO');
  expect(d.videoUrl, 'flipping the flag must not invent a video').toBeNull();
});
