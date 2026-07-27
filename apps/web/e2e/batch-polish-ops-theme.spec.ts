import { expect, test, type Page } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * Batch POLISH Unit 4 (follow-up) — the Ops Center theme, measured.
 *
 * The light theme was a partial patch: it hand-wrote 20 of the dark theme's 40
 * palette mappings, and its selectors used a descendant combinator, so they
 * could never reach the ops ROOT — the one element that carries both the theme
 * attribute and `bg-[#0d1117] text-[#e6edf3]`. The page canvas and every piece
 * of inherited body text therefore stayed GitHub-dark on a white surface.
 * Measured before: 57 / 48 / 65 contrast failures on /ops, /ops/money,
 * /ops/users, worst pair 1.18:1.
 *
 * These tests measure rather than inspect, because every wrong guess in that
 * investigation came from reading CSS instead of reading pixels.
 */

let apiUp = false;
test.beforeAll(async () => {
  try {
    apiUp = (await fetch(`${API}/v1/health`)).ok;
  } catch {
    apiUp = false;
  }
});

async function enterOps(page: Page): Promise<void> {
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
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    document.querySelector('[data-ops-root]')?.setAttribute('data-theme', t);
  }, theme);
  // The shell transitions colour; sampling mid-transition reads greys that
  // belong to neither theme.
  await page.waitForTimeout(600);
}

/**
 * Every failing pair on the page, computed the way a reader actually sees it:
 *
 *  - colours resolved through a canvas readback, because Tailwind v4 authors
 *    its whole palette as `oklch()` and an rgb()-only parser silently SKIPS
 *    every one of them (this is why an earlier sweep reported 0 failures on a
 *    board that had 58);
 *  - translucent layers composited down the ancestor stack, since a chip at
 *    /10 over a card is neither the chip nor the card;
 *  - element opacity folded into the foreground;
 *  - inactive controls excluded — WCAG 1.4.3 exempts them, and a disabled
 *    button is dimmed on purpose.
 */
async function contrastFailures(page: Page): Promise<
  Array<{ ratio: number; need: number; txt: string; fg: string; bg: string }>
> {
  return page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const cx = cv.getContext('2d', { willReadFrequently: true })!;
    const rgbOf = (c: string): [number, number, number, number] => {
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

    const out: Array<{ ratio: number; need: number; txt: string; fg: string; bg: string }> = [];
    document.querySelectorAll('[data-ops-root] *').forEach((el) => {
      const t = (el.textContent ?? '').trim();
      if (!t || el.children.length > 0) return;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none') return;
      if (el.closest('[disabled],[aria-disabled="true"]')) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;

      const stack: Array<[number, number, number, number]> = [];
      let n: Element | null = el;
      while (n) {
        const c = rgbOf(getComputedStyle(n).backgroundColor);
        if (c[3] > 0.001) {
          stack.push(c);
          if (c[3] >= 0.999) break;
        }
        n = n.parentElement;
      }
      if (!stack.length || stack[stack.length - 1][3] < 0.999) stack.push([255, 255, 255, 1]);
      let bg = stack[stack.length - 1].slice(0, 3);
      for (let i = stack.length - 2; i >= 0; i--) {
        const l = stack[i];
        bg = [0, 1, 2].map((k) => Math.round(l[k] * l[3] + bg[k] * (1 - l[3])));
      }
      const raw = rgbOf(s.color);
      const a = raw[3] * parseFloat(s.opacity || '1');
      const fg = [0, 1, 2].map((k) => Math.round(raw[k] * a + bg[k] * (1 - a)));

      const size = parseFloat(s.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      const got = ratio(fg, bg);
      if (got < need) {
        out.push({
          ratio: Number(got.toFixed(2)),
          need,
          txt: t.slice(0, 30),
          fg: `rgb(${fg.join(',')})`,
          bg: `rgb(${bg.join(',')})`,
        });
      }
    });
    return out;
  });
}

// Three boards with genuinely different furniture: dashboard cards + status
// chips, a money board, and a long data table.
const BOARDS = ['/ops', '/ops/users', '/ops/analytics'];

for (const theme of ['light', 'dark'] as const) {
  test(`T1(${theme}): every ops board clears WCAG 1.4.3 in ${theme} mode`, async ({ page }) => {
    test.skip(!apiUp, 'API unreachable — skipping live ops-theme spec');
    await enterOps(page);

    for (const board of BOARDS) {
      await page.goto(board);
      await setTheme(page, theme);
      const fails = await contrastFailures(page);
      expect(
        fails,
        `${board} (${theme}) — ${fails.length} pair(s) below threshold:\n` +
          fails.map((f) => `  ${f.ratio}<${f.need} "${f.txt}" ${f.fg} on ${f.bg}`).join('\n'),
      ).toEqual([]);
    }
  });
}

test('T2: the theme reaches the ops ROOT, not just its descendants', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-theme spec');
  await enterOps(page);

  // The regression this guards: the root carries the theme attribute AND the
  // palette classes, so a `[data-ops-root] .bg-[#0d1117]` selector skips it and
  // the canvas keeps its dark value under a light theme.
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    const root = await page.locator('[data-ops-root]').evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, fg: s.color };
    });
    const mean = (c: string): number => {
      const p = c.match(/\d+/g)!.map(Number);
      return (p[0] + p[1] + p[2]) / 3;
    };
    if (theme === 'light') {
      expect(mean(root.bg), `light canvas should be light, got ${root.bg}`).toBeGreaterThan(200);
      expect(mean(root.fg), `light body text should be dark, got ${root.fg}`).toBeLessThan(90);
    } else {
      expect(mean(root.bg), `dark canvas should be dark, got ${root.bg}`).toBeLessThan(60);
      expect(mean(root.fg), `dark body text should be light, got ${root.fg}`).toBeGreaterThan(180);
    }
  }
});

test('T3: `text-base` is a font size, not a colour', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-theme spec');
  await enterOps(page);

  // A `--color-base` key in @theme makes Tailwind v4 emit `.text-base{color:…}`
  // and DROP the core font-size utility of the same name. All 48 uses in the
  // ops screens are `text-base font-bold` headings asking for a size; they were
  // getting a near-white colour instead — 1.02:1 once the surface turned light.
  await setTheme(page, 'light');
  const h2 = page.locator('[data-ops-root] h2.text-base').first();
  await expect(h2).toBeVisible();
  const style = await h2.evaluate((el) => {
    const s = getComputedStyle(el);
    return { size: parseFloat(s.fontSize), color: s.color };
  });
  expect(style.size, '`text-base` must still set 1rem').toBeCloseTo(16, 1);
  const mean = style.color.match(/\d+/g)!.map(Number).slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  expect(mean, 'the heading must not be painted the canvas colour').toBeLessThan(120);
});
