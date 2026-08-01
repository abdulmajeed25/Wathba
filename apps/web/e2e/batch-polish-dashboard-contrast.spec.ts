import { expect, test, type Page } from '@playwright/test';
import { apiSignin, seededIds } from './helpers';

/**
 * Batch POLISH Unit 4 (third pass) — the SIGNED-IN surface.
 *
 * The creator dashboard is its own design system: `wathba-dashboard-shell.tsx`
 * carries no `data-theme` at all and paints straight from the `:root` tokens in
 * globals.css, so neither the ops remap nor the ventures theme reached it. It
 * measured 61 failing pairs, and 46 of them were one mistake repeated: the
 * brand green used as COPY.
 *
 * `--brand-primary` (#05a661) is 3.17:1 on white. That is a legal ratio for a
 * FILL and an illegal one for text, which is exactly the split the public site
 * already learned in the previous pass (`--accent` / `--accent-ink`). So the
 * green did not move — `--brand-ink` and `--on-brand` were added beside it and
 * every `color:` site in the dashboard was routed to them. The status hues that
 * were also doing double duty (#ef4444, #f59e0b, #6366f1, #10b981, #a96400)
 * were darkened along their own hue until they clear 4.5:1 on every dashboard
 * ground; their tinted chip backgrounds were left alone so hue still signals
 * status, and the fills that carry no text — the sidebar status dot, the
 * analytics bars, the milestone gradients — were left vivid.
 *
 * The measurement rules are the ones the earlier passes had to learn: canvas
 * readback (Tailwind v4 authors its palette in oklch()), translucent ancestors
 * composited down the stack, element `opacity` folded into the foreground, and
 * WCAG's own exemptions for inactive controls and aria-hidden decoration.
 */

const TABS = [
  '', '/story', '/rewards', '/updates', '/backers', '/comments', '/community',
  '/milestones', '/payouts', '/analytics', '/activity', '/faq', '/contests',
  '/rfqs', '/creator', '/settings', '/preview',
];

async function signIn(page: Page): Promise<void> {
  // The seeded project belongs to smoke-s1 (see global-setup), and the creator
  // dashboard is owner-only — so the sweep has to be that account.
  const jwt = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');
  const host = new URL(process.env.E2E_WEB_URL ?? 'http://localhost:3123').hostname;
  await page.context().addCookies([
    { name: 'wathba_session', value: jwt, domain: host, path: '/' },
  ]);
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
    document.body.querySelectorAll('*').forEach((el) => {
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

test('D1: every creator-dashboard tab clears WCAG 1.4.3', async ({ page }) => {
  test.slow();
  await signIn(page);
  const { projectId } = seededIds();
  for (const tab of TABS) {
    await page.goto(`/projects/dashboard/${projectId}${tab}`);
    await page.waitForTimeout(900);
    const fails = await failures(page);
    expect(
      fails,
      `${tab || '/(overview)'} — ${fails.length} pair(s) below threshold:\n` +
        fails.map((f) => `  ${f.ratio}<${f.need} "${f.txt}" ${f.fg} on ${f.bg}`).join('\n'),
    ).toEqual([]);
  }
});

test('D2: the signed-in account pages clear WCAG 1.4.3', async ({ page }) => {
  // /projects/me/profile was the one failure outside the dashboard: «شريك مؤسس»
  // in --purple, 4.49:1 on the profile band. Purple got the same fill/ink split
  // --gold and --pos already had.
  await signIn(page);
  for (const path of ['/projects/settings', '/projects/me/profile', '/projects/me/pledges']) {
    await page.goto(path);
    await page.waitForTimeout(900);
    const fails = await failures(page);
    expect(
      fails,
      `${path} — ${fails.length} pair(s) below threshold:\n` +
        fails.map((f) => `  ${f.ratio}<${f.need} "${f.txt}" ${f.fg} on ${f.bg}`).join('\n'),
    ).toEqual([]);
  }
});

test('D3: the dashboard splits the brand FILL from the brand INK', async ({ page }) => {
  // If a later pass "fixes" a contrast failure by darkening --brand-primary,
  // every green button and bar on the signed-in surface changes colour and this
  // is the test that should object. The ink is what moves, never the green.
  await signIn(page);
  const { projectId } = seededIds();
  await page.goto(`/projects/dashboard/${projectId}`);
  const t = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const get = (n: string): string => cs.getPropertyValue(n).trim().toLowerCase();
    return {
      brand: get('--brand-primary'),
      ink: get('--brand-ink'),
      onBrand: get('--on-brand'),
    };
  });
  expect(t.brand).toBe('#05a661');
  expect(t.ink).not.toBe(t.brand);
  expect(t.onBrand).not.toBe(t.brand);
});
