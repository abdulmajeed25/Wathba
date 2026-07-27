import { expect, test, type Page } from '@playwright/test';

/**
 * Batch POLISH Unit 4 (follow-up) — the PUBLIC site, measured in both themes.
 *
 * Same story as the Ops Center, same cause: these components were authored
 * dark-first and light was assumed rather than measured. Before this pass:
 * 53 failing pairs in light against 5 in dark, over 9 pages. The big one was
 * the primary CTA — `--on-accent` was `#ffffff` over the brand gradient, i.e.
 * white on a green of almost the same lightness, 2.39:1, on every button on
 * the site. The green did not move; the ink on it did.
 *
 * The measurement is the point here. Three things it has to get right, each of
 * which silently under-reported when it did not:
 *
 *   1. Gradients are background-IMAGES. Walking the ancestor chain for a
 *      background-COLOUR sails straight past `--grad` and lands on the page,
 *      reporting white-on-white for every CTA. Each stop is resolved and the
 *      WORST one is the ground, because the text has to be readable across the
 *      whole sweep of the gradient.
 *   2. Colours are resolved by canvas readback. Tailwind v4 authors its palette
 *      as oklch() and an rgb()-only parser skips every one of them.
 *   3. Translucent layers are composited down the stack, and element opacity is
 *      folded into the foreground.
 *
 * Excluded, by the spec's own rules: `background-clip:text` (the gradient IS
 * the glyphs, so a sampled `color` is fiction), text over photographs (no
 * single measurable ground), inactive controls, and aria-hidden decoration.
 */

const PAGES = ['/projects', '/projects/discover-all', '/spotlight', '/projects/ranks'];

async function goTheme(page: Page, path: string, theme: 'light' | 'dark'): Promise<void> {
  await page.goto(path);
  await page.waitForTimeout(900);
  if (theme === 'dark') {
    const root = page.locator('[data-theme]').first();
    if ((await root.getAttribute('data-theme')) !== 'dark') {
      await page.getByTitle('تبديل النمط').click();
    }
    // The shell animates `background .4s, color .4s`; sampling any sooner reads
    // mid-transition greys that belong to neither theme.
    await page.waitForTimeout(800);
  }
  await expect(page.locator(`[data-theme="${theme}"]`).first()).toBeAttached();
  // Below-the-fold sections only mount once they are scrolled to.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

async function failures(page: Page): Promise<Array<{ ratio: number; need: number; txt: string; fg: string; bg: string }>> {
  return page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const cx = cv.getContext('2d', { willReadFrequently: true })!;
    const rgbOf = (c: string): number[] => {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = c;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const lum = (c: number[]): number => {
      const f = (v: number): number => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const ratio = (a: number[], b: number[]): number => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    const stopsOf = (img: string): number[][] | null => {
      if (!img || img === 'none' || /url\(/.test(img)) return null;
      const toks = img.match(/(rgba?\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]{3,8})/gi) ?? [];
      const cols = toks.map(rgbOf).filter((c) => c[3] >= 0.999);
      return cols.length ? cols : null;
    };

    const out: Array<{ ratio: number; need: number; txt: string; fg: string; bg: string }> = [];
    const root = document.querySelector('[data-pillar="ventures"]') ?? document.body;
    root.querySelectorAll('*').forEach((el) => {
      const t = (el.textContent ?? '').trim();
      if (!t || el.children.length > 0) return;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return;
      if (el.closest('[disabled],[aria-disabled="true"],[aria-hidden="true"]')) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      if ((s.webkitBackgroundClip || s.backgroundClip) === 'text') return;

      const stack: number[][] = [];
      let n: Element | null = el;
      let onImage = false;
      let gradient: number[][] | null = null;
      while (n) {
        const cs = getComputedStyle(n);
        if (/url\(/.test(cs.backgroundImage || '')) { onImage = true; break; }
        const c = rgbOf(cs.backgroundColor);
        if (c[3] > 0.001) { stack.push(c); if (c[3] >= 0.999) break; }
        const g = stopsOf(cs.backgroundImage);
        if (g) { gradient = g; break; }
        n = n.parentElement;
      }
      if (onImage) return;

      const flatten = (base: number[]): number[] => {
        let bg = base.slice(0, 3);
        for (let i = stack.length - 1; i >= 0; i--) {
          const l = stack[i];
          bg = [0, 1, 2].map((k) => Math.round(l[k] * l[3] + bg[k] * (1 - l[3])));
        }
        return bg;
      };
      const grounds: number[][] = [];
      if (gradient) for (const g of gradient) grounds.push(flatten(g));
      else if (stack.length && stack[stack.length - 1][3] >= 0.999) grounds.push(flatten(stack.pop()!));
      else grounds.push(flatten([255, 255, 255, 1]));

      const size = parseFloat(s.fontSize);
      const need = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700) ? 3 : 4.5;
      const raw = rgbOf(s.color);
      const a = raw[3] * parseFloat(s.opacity || '1');
      let got = Infinity, bg = grounds[0], fg = grounds[0];
      for (const gr of grounds) {
        const f = [0, 1, 2].map((k) => Math.round(raw[k] * a + gr[k] * (1 - a)));
        const rr = ratio(f, gr);
        if (rr < got) { got = rr; bg = gr; fg = f; }
      }
      if (got < need) {
        out.push({ ratio: Number(got.toFixed(2)), need, txt: t.slice(0, 30), fg: `rgb(${fg.join(',')})`, bg: `rgb(${bg.join(',')})` });
      }
    });
    return out;
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`P1(${theme}): the public site clears WCAG 1.4.3 in ${theme} mode`, async ({ page }) => {
    for (const path of PAGES) {
      await goTheme(page, path, theme);
      const fails = await failures(page);
      expect(
        fails,
        `${path} (${theme}) — ${fails.length} pair(s) below threshold:\n` +
          fails.map((f) => `  ${f.ratio}<${f.need} "${f.txt}" ${f.fg} on ${f.bg}`).join('\n'),
      ).toEqual([]);
    }
  });
}

test('P2: the brand green is UNCHANGED — only the ink on it moved', async ({ page }) => {
  // The whole point of the fix. If a later pass "solves" a contrast failure by
  // darkening --accent or --grad, Wathba's identity colour has been edited and
  // this test is the one that should object.
  await page.goto('/projects');
  const tokens = await page.evaluate(() => {
    const el = document.querySelector('[data-theme]') as HTMLElement;
    const cs = getComputedStyle(el);
    return {
      accent: cs.getPropertyValue('--accent').trim(),
      grad: cs.getPropertyValue('--grad').trim(),
      onAccent: cs.getPropertyValue('--on-accent').trim(),
    };
  });
  expect(tokens.accent.toLowerCase()).toBe('#05a661');
  expect(tokens.grad).toContain('#05c074');
  expect(tokens.grad).toContain('#03a98e');
  // …and the ink on it is dark, the way the dark theme has always done it.
  expect(tokens.onAccent.toLowerCase()).toBe('#08130d');
});

test('P3: fill tokens and ink tokens stay separate', async ({ page }) => {
  // --accent/--gold/--pos paint FILLS (bars, dots, badges) and are vivid.
  // --accent-ink/--gold-ink/--pos-ink are the readable values for COPY on a
  // light ground. Collapsing the two is how «محسن» ended up at 3.17:1.
  await page.goto('/projects');
  const t = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('[data-theme]') as HTMLElement);
    const get = (n: string) => cs.getPropertyValue(n).trim().toLowerCase();
    return {
      accent: get('--accent'), accentInk: get('--accent-ink'),
      gold: get('--gold'), goldInk: get('--gold-ink'),
      pos: get('--pos'), posInk: get('--pos-ink'),
    };
  });
  expect(t.accentInk).not.toBe(t.accent);
  expect(t.goldInk).not.toBe(t.gold);
  expect(t.posInk).not.toBe(t.pos);
});
