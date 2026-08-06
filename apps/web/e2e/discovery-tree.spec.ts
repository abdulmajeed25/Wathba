import { expect, test } from '@playwright/test';

/**
 * HOME-REVIEW O4 — the discovery tree has to be reachable without JavaScript.
 *
 * sitemap.ts declared ~200 category and subcategory URLs and ZERO of them
 * appeared in server-rendered HTML: the mega-menu built them client-side and
 * only on hover. A human found them; a crawler that does not execute JS did
 * not, while the sitemap promised all of them.
 *
 * Every assertion here uses `request`, not `page`. That is deliberate and it is
 * the only thing that makes this spec meaningful: `page` runs the mega-menu's
 * JavaScript, so a browser-based version of these checks would have passed
 * against the broken build too.
 */

const HREF = /href="\/projects\/discover\/([a-z0-9-]+)"/g;

function discoverLinks(html: string): string[] {
  return [...new Set([...html.matchAll(HREF)].map((m) => m[1]!))];
}

test('C1: the canonical discovery page server-renders the whole top level', async ({ request }) => {
  const html = await (await request.get('/projects/discover-all')).text();
  const slugs = discoverLinks(html);
  // 21 top-level categories at the time of writing; asserting a floor rather
  // than the exact count so adding a category does not fail the suite.
  expect(slugs.length, `server-rendered category links: ${slugs.length}`).toBeGreaterThanOrEqual(15);
});

test('C2: every server-rendered category link matches what the sitemap declares', async ({
  request,
}) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const declared = new Set(
    [...xml.matchAll(/\/projects\/discover\/([a-z0-9-]+)</g)].map((m) => m[1]!),
  );
  const rendered = discoverLinks(await (await request.get('/projects/discover-all')).text());

  expect(rendered.length).toBeGreaterThan(0);
  // A link the sitemap does not declare is the old split: the site pointing at
  // one URL space while the sitemap advertises another.
  const undeclared = rendered.filter((s) => !declared.has(s));
  expect(undeclared, `linked but not in the sitemap: ${undeclared.join(', ')}`).toEqual([]);
});

test('C3: everything the sitemap declares is reachable by following links, no JS', async ({
  request,
}) => {
  test.slow(); // one request per category

  const xml = await (await request.get('/sitemap.xml')).text();
  const declared = new Set(
    [...xml.matchAll(/(\/projects\/discover\/[a-z0-9-]+(?:\/[a-z0-9-]+)?)</g)].map((m) => m[1]!),
  );
  expect(declared.size, 'sitemap declares a discovery tree').toBeGreaterThan(50);

  // Walk the way a crawler without JS would: start at the discovery entry, take
  // every category link it finds in HTML, then take every link those pages
  // hand back. Two hops is the whole depth of the tree.
  const ANY = /href="(\/projects\/discover\/[a-z0-9-]+(?:\/[a-z0-9-]+)?)"/g;
  const linksIn = (html: string) => [...new Set([...html.matchAll(ANY)].map((m) => m[1]!))];

  const reached = new Set(linksIn(await (await request.get('/projects/discover-all')).text()));
  for (const url of [...reached]) {
    if (url.split('/').length > 4) continue; // already a subcategory
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
    for (const child of linksIn(await res.text())) reached.add(child);
  }

  // The defect was a sitemap promising ~200 URLs that no crawler could walk to.
  // Anything declared and unreachable is that defect returning.
  const unreachable = [...declared].filter((u) => !reached.has(u));
  expect(
    unreachable.length,
    `declared in the sitemap but not reachable by link-following: ${unreachable.slice(0, 8).join(', ')}${unreachable.length > 8 ? ` (+${unreachable.length - 8})` : ''}`,
  ).toBe(0);
});

test('C4: the homepage chips are the live taxonomy, on the canonical URLs', async ({ request }) => {
  const html = await (await request.get('/projects')).text();

  // The legacy space must be gone from the homepage: it was never in the
  // sitemap, was self-canonical, and titled itself «فئة art» with the raw slug.
  expect(html, 'homepage still links the legacy /projects/category space').not.toContain(
    'href="/projects/category/',
  );

  const slugs = discoverLinks(html);
  expect(slugs.length, 'homepage category chips').toBeGreaterThanOrEqual(6);

  // `film` and `tech` are the fixture's slugs; the live taxonomy calls them
  // `film-video` and `technology`. Their presence means the fixture is back.
  expect(slugs, 'fixture slug leaked into the chip row').not.toContain('film');
  expect(slugs, 'fixture slug leaked into the chip row').not.toContain('tech');
});

test('C5: every homepage chip resolves to a real category page', async ({ request }) => {
  const slugs = discoverLinks(await (await request.get('/projects')).text());
  for (const slug of slugs) {
    const res = await request.get(`/projects/discover/${slug}`);
    expect(res.status(), `/projects/discover/${slug}`).toBe(200);
    // A category that does not exist answers 200 with no <h1> — the /projects/*
    // soft-404 recorded in orphan-routes.spec.ts. Checking for the heading is
    // what actually distinguishes a real category from that empty shell, which
    // is how the dead `film` chip hid.
    const html = await res.text();
    expect(html, `${slug} renders an empty page`).toMatch(/<h1[^>]*>[^<]+/);
  }
});
