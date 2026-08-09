import { expect, test } from '@playwright/test';

import { API, apiSignin, seededIds } from './helpers';

/**
 * Batch DISCOVERY-ENGINE Unit 1 — the curated tag vocabulary.
 *
 * The vocabulary is CURATED rather than free text, and every assertion here is
 * ultimately about that choice holding: a creator can only attach tags that
 * exist, a retired tag cannot come back through the write path, and the
 * typeahead has to be forgiving enough in Arabic that picking from a list is
 * not worse than typing freely.
 */

async function patch(jwt: string, id: string, body: Record<string, unknown>) {
  return fetch(`${API}/v1/projects/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
}

async function detailTags(jwt: string, id: string): Promise<string[]> {
  const r = await fetch(`${API}/v1/projects/${id}`, { headers: { authorization: `Bearer ${jwt}` } });
  const j = (await r.json()) as { tags?: Array<{ slug: string }> };
  return (j.tags ?? []).map((t) => t.slug).sort();
}

test('TG1: the vocabulary is served, ordered by use', async () => {
  const r = await fetch(`${API}/v1/tags`);
  expect(r.status).toBe(200);
  const j = (await r.json()) as { items: Array<{ slug: string; nameAr: string; usageCount: number }> };
  expect(j.items.length, 'the tag vocabulary is empty — seed-tags.mjs has not run').toBeGreaterThan(10);

  // Most-used first is what makes the picker useful without a query: the
  // creator sees what the platform actually tags things with.
  const counts = j.items.map((t) => t.usageCount);
  expect(counts).toEqual([...counts].sort((a, b) => b - a));

  // Arabic labels, not slugs, are what a creator reads.
  expect(j.items.every((t) => /[؀-ۿ]/.test(t.nameAr))).toBe(true);
});

test('TG2: the typeahead is forgiving of a partial Arabic word', async () => {
  // «حرف» is a fragment of «يحفظ حرفة» — a prefix match on the slug would miss
  // it entirely, which is the whole reason this path is trigram + ILIKE rather
  // than a startsWith over a cached array.
  const r = await fetch(`${API}/v1/tags/suggest?q=${encodeURIComponent('حرف')}`);
  const j = (await r.json()) as { items: Array<{ nameAr: string }> };
  expect(j.items.length, 'a 3-letter Arabic fragment returned nothing').toBeGreaterThan(0);
  expect(j.items.some((t) => t.nameAr.includes('حرف'))).toBe(true);
});

test('TG3: an empty query returns the head of the vocabulary, not nothing', async () => {
  const r = await fetch(`${API}/v1/tags/suggest?q=`);
  const j = (await r.json()) as { items: unknown[] };
  // An empty picker is a dead end. Opening it must show something to pick.
  expect(j.items.length).toBeGreaterThan(0);
});

test('TG4: a creator sets the whole set, and unknown slugs are dropped not fatal', async () => {
  const { projectId } = seededIds();
  const jwt = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');

  const res = await patch(jwt, projectId, { tagSlugs: ['saudi-heritage', 'handmade', 'no-such-tag'] });
  // A slug ops retired between page load and save must not fail the creator's
  // other edits — they cannot act on the error.
  expect(res.status, `PATCH returned ${res.status}`).toBe(200);
  expect(await detailTags(jwt, projectId)).toEqual(['handmade', 'saudi-heritage']);

  // Whole-set semantics: sending a shorter list REMOVES, it does not merge.
  await patch(jwt, projectId, { tagSlugs: ['handmade'] });
  expect(await detailTags(jwt, projectId)).toEqual(['handmade']);

  // …and clearing is a legal save.
  await patch(jwt, projectId, { tagSlugs: [] });
  expect(await detailTags(jwt, projectId)).toEqual([]);
});

test('TG5: tags are editable on a LIVE project — they are discoverability, not terms', async () => {
  const { projectId } = seededIds();
  const jwt = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');

  // The seeded project is LIVE. The pre-launch freeze exists to lock the
  // funding contract and the pitch a backer read before pledging; a tag is
  // neither, and a creator who realises mid-campaign where their project
  // belongs has to be able to say so.
  const ok = await patch(jwt, projectId, { tagSlugs: ['rural'] });
  expect(ok.status).toBe(200);

  // The freeze still holds for everything else.
  const frozen = await patch(jwt, projectId, { fundingGoalHalalas: 5_000_000 });
  expect(frozen.status, 'the funding goal must still be frozen after launch').toBe(400);

  await patch(jwt, projectId, { tagSlugs: [] });
});

test('TG6: usageCount tracks the join table in both directions', async () => {
  const { projectId } = seededIds();
  const jwt = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');
  const countOf = async (slug: string): Promise<number> => {
    const r = await fetch(`${API}/v1/tags`);
    const j = (await r.json()) as { items: Array<{ slug: string; usageCount: number }> };
    return j.items.find((t) => t.slug === slug)?.usageCount ?? 0;
  };

  await patch(jwt, projectId, { tagSlugs: [] });
  const before = await countOf('cooperative');
  await patch(jwt, projectId, { tagSlugs: ['cooperative'] });
  expect(await countOf('cooperative'), 'attaching did not raise the counter').toBe(before + 1);

  // The direction that actually breaks: a tag that LOSES a project has to be
  // recounted too, or the counter ratchets upward forever and the picker's
  // ordering rots. Recompute-not-increment is what makes this hold.
  await patch(jwt, projectId, { tagSlugs: [] });
  expect(await countOf('cooperative'), 'detaching did not lower the counter').toBe(before);
});

test('TG7: a project page shows its tags, and each links back into discovery', async ({ page }) => {
  // READ-ONLY, deliberately. The first version of this test PATCHed the seeded
  // project and then loaded its page, and it flaked: the campaign route is
  // `revalidate = 60`, so the render served after the PATCH is the one built
  // before it. Finding a project that ALREADY carries tags removes the cache
  // race and the mutation together.
  const r = await fetch(`${API}/v1/discover?take=24`);
  const { items } = (await r.json()) as { items: Array<{ id: string }> };

  let tagged: { id: string; slug: string; nameAr: string } | null = null;
  for (const it of items.slice(0, 12)) {
    const d = await fetch(`${API}/v1/projects/${it.id}`);
    if (!d.ok) continue;
    const j = (await d.json()) as { tags?: Array<{ slug: string; nameAr: string }> };
    if (j.tags?.length) {
      tagged = { id: it.id, ...j.tags[0]! };
      break;
    }
  }
  test.skip(!tagged, 'no discoverable project carries a tag — seed-tags.mjs --attach has not run');

  await page.goto(`/projects/${tagged!.id}`);
  const list = page.getByRole('list', { name: 'وسوم المشروع' });
  await expect(list).toBeVisible();

  // A tag that only decorates the page is a wasted signal — it has to be a way
  // back into discovery, across categories.
  const link = list.getByRole('link', { name: tagged!.nameAr });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', new RegExp(`tag=${tagged!.slug}`));
});
