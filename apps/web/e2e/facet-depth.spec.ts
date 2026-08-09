import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * Batch DISCOVERY-ENGINE Unit 2 — the category facet at depth 3.
 *
 * The tree was two levels everywhere except the schema: the slug expansion
 * descended exactly one hop, the facet builder had a hardcoded parent/children
 * loop, and the wire format was a flat list with a single `parentSlug` that
 * could not express a grandchild at all. These assertions are about the whole
 * chain being depth-N — payload, counts, URL, and the sidebar — not just the
 * renderer.
 */

interface FacetNode {
  slug: string;
  nameAr: string;
  parentSlug: string | null;
  count: number;
  ownCount: number;
  path: string;
  catParam: string;
  depth: number;
  hasChildren: boolean;
}

async function facets(qs = ''): Promise<{ categories: FacetNode[] } & Record<string, unknown>> {
  const r = await fetch(`${API}/v1/discover/facets${qs}`);
  return r.json() as Promise<{ categories: FacetNode[] } & Record<string, unknown>>;
}

test('FD1: the facet payload reaches depth 3 and carries a usable path', async () => {
  const f = await facets();
  const deep = f.categories.filter((c) => c.depth >= 2);
  test.skip(deep.length === 0, 'no third-level category seeded — run seed-categories-l3.mjs');

  const node = deep[0]!;
  // The old wire type had slug + parentSlug + count and nothing else, which
  // cannot distinguish a grandchild from a child of a same-named parent.
  expect(node.path.split('/')).toHaveLength(3);
  expect(node.catParam).toBe(node.path.replace(/\//g, '.'));
  expect(node.parentSlug, 'a depth-2 node must name its immediate parent').toBeTruthy();
});

test('FD2: the array is pre-order, so depth alone renders the tree', async () => {
  const f = await facets();
  const rows = f.categories;
  test.skip(!rows.some((c) => c.depth >= 2), 'no third level seeded');

  // The contract that makes a FLAT payload isomorphic to a tree: a node is
  // immediately followed by its subtree. A renderer that trusts `depth` is
  // wrong the moment this breaks, and it breaks silently.
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1]!;
    const cur = rows[i]!;
    if (cur.depth > prev.depth) {
      expect(cur.depth, 'depth jumped by more than one — the array is not pre-order').toBe(prev.depth + 1);
      expect(cur.path.startsWith(`${prev.path}/`)).toBe(true);
    }
  }
});

test('FD3: counts roll up through every level, not just one', async () => {
  const f = await facets();
  const byPath = new Map(f.categories.map((c) => [c.path, c]));
  const parents = f.categories.filter((c) => c.hasChildren && c.depth >= 1);
  test.skip(parents.length === 0, 'no third level seeded');

  for (const p of parents) {
    const kids = f.categories.filter((c) => c.path.startsWith(`${p.path}/`) && c.depth === p.depth + 1);
    if (!kids.length) continue;
    const rolled = p.ownCount + kids.reduce((s, k) => s + k.count, 0);
    // The old builder summed own + DIRECT children only, so a grandchild's
    // projects were missing from its grandparent's number.
    expect(p.count, `${p.path} rolled ${p.count}, expected ${rolled}`).toBe(rolled);
  }
  // And the top level rolls the whole subtree.
  const tops = f.categories.filter((c) => c.depth === 0 && c.hasChildren);
  for (const t of tops) {
    const sub = f.categories.filter((c) => c.path.startsWith(`${t.path}/`));
    const all = t.ownCount + sub.filter((c) => c.depth === 1).reduce((s, c) => s + c.count, 0);
    expect(t.count).toBe(all);
    void byPath;
  }
});

test('FD4: a path-qualified ?cat= selects one node and includes its descendants', async () => {
  const f = await facets();
  const parent = f.categories.find((c) => c.depth === 1 && c.hasChildren);
  test.skip(!parent, 'no second-level category with children');

  const kids = f.categories.filter((c) => c.path.startsWith(`${parent!.path}/`));
  const filtered = await fetch(`${API}/v1/discover?cat=${encodeURIComponent(parent!.catParam)}&take=1`);
  const j = (await filtered.json()) as { total: number };

  // Selecting a parent must include everything beneath it, at any depth —
  // that is the parent-includes-children promise, and the one-hop expansion
  // could not keep it once a third level existed.
  expect(j.total, `${parent!.catParam} returned ${j.total}, expected its rolled ${parent!.count}`).toBe(parent!.count);
  expect(kids.length).toBeGreaterThan(0);
});

test('FD5: a bare slug still works — old links do not break', async () => {
  const f = await facets();
  const top = f.categories.find((c) => c.depth === 0 && c.count > 0)!;

  const [byBare, byPath] = await Promise.all([
    fetch(`${API}/v1/discover?cat=${top.slug}&take=1`).then((r) => r.json() as Promise<{ total: number }>),
    fetch(`${API}/v1/discover?cat=${top.catParam}&take=1`).then((r) => r.json() as Promise<{ total: number }>),
  ]);
  // A top-level slug is globally unique, so the two forms must agree exactly.
  expect(byBare.total).toBe(byPath.total);
  expect(byBare.total).toBe(top.count);
});

test('FD6: a typo in a qualified ref resolves to nothing, not to everything', async () => {
  const r = await fetch(`${API}/v1/discover?cat=technology.no-such-child&take=1`);
  const j = (await r.json()) as { total: number };
  // The dangerous failure mode: falling back to bare-slug matching on a typo,
  // which would silently widen the filter instead of narrowing it.
  expect(j.total).toBe(0);
});

test('FD7: the sidebar renders the tree and restores multi-select from the URL', async ({ page }) => {
  const f = await facets();
  const deep = f.categories.find((c) => c.depth >= 2);
  test.skip(!deep, 'no third level seeded');

  // Two categories selected, one of them three levels down, straight from the
  // URL — the state the sidebar has to be able to restore on a shared link.
  const top = f.categories.find((c) => c.depth === 0 && c.count > 0)!;
  await page.goto(`/projects/discover-all?cat=${encodeURIComponent(`${top.catParam},${deep!.catParam}`)}`);

  await expect(page.getByTestId(`cat-${top.slug}`)).toHaveAttribute('aria-checked', 'true');

  // Expand to reach the deep node, then walk it open.
  await page.getByRole('button', { name: 'عرض المزيد' }).first().click();
  const parts = deep!.path.split('/');
  for (let i = 1; i < parts.length; i += 1) {
    const ancestor = f.categories.find((c) => c.path === parts.slice(0, i).join('/'));
    if (!ancestor?.hasChildren) continue;
    const toggle = page.getByRole('button', { name: new RegExp(`توسيع ${ancestor.nameAr}`) });
    if (await toggle.count()) await toggle.first().click();
  }

  const leaf = page.getByTestId(`cat-${deep!.slug}`);
  await expect(leaf, 'the depth-3 node never became reachable').toBeVisible();
  await expect(leaf, 'the URL selection was not restored at depth 3').toHaveAttribute('aria-checked', 'true');
});
