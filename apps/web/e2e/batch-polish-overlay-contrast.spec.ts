import { expect, test, type Page } from '@playwright/test';
import { apiSignin, seededIds } from './helpers';

/**
 * Batch POLISH Unit 4 (fourth pass) — the OVERLAYS.
 *
 * The three earlier passes measured rendered pages. Modals never open on their
 * own, so nothing had ever measured them — and the shared confirm dialog was
 * failing at 3.74:1 the whole time.
 *
 * The cause was structural, not a colour choice. `wathba-shell.tsx` mounted
 * `<WathbaFeedbackProvider>` as the PARENT of the `<div data-theme
 * data-pillar="ventures">` that defines the tokens, and the provider emits its
 * toasts and confirm dialog AFTER `{children}` — so they rendered as siblings
 * of the themed element. `var(--card)`, `var(--text)`, `var(--muted)`,
 * `var(--grad)` and `var(--on-accent)` all resolved to nothing: the dialog had
 * no panel at all and its copy sat on the bare 55% scrim over the page.
 *
 * The tell was that light and dark produced byte-identical ratios. A theme bug
 * that reads the same in both themes is not a theme bug — the theme is not
 * reaching the element. That is what T1 pins.
 *
 * The toasts were in the same position and passed only by luck: transparent
 * card, inherited near-black text, light page behind it. Nothing about that was
 * deliberate, and it would have inverted the first time a toast fired over a
 * dark surface.
 */

const CONFIRM = '[role="alertdialog"]';

async function signIn(page: Page): Promise<void> {
  const jwt = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');
  const host = new URL(process.env.E2E_WEB_URL ?? 'http://localhost:3123').hostname;
  await page.context().addCookies([
    { name: 'wathba_session', value: jwt, domain: host, path: '/' },
  ]);
}

/**
 * The styled dialog only exists under the ventures shell, and both of its call
 * sites need data this account owns. Cancelling a pledge needs a pledge; so the
 * cheap one is a comment — post it, open its delete confirm, and let the caller
 * measure. `dismiss` then confirms the delete, so the row this test created
 * does not outlive it.
 */
async function openDeleteConfirm(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const { projectId } = seededIds();
  await page.goto(`/projects/${projectId}/comments`);
  await page.waitForTimeout(900);
  if (theme === 'dark') {
    const root = page.locator('[data-theme]').first();
    if ((await root.getAttribute('data-theme')) !== 'dark') {
      await page.getByTitle('تبديل النمط').click();
    }
    // The shell animates `background .4s, color .4s`.
    await page.waitForTimeout(800);
  }
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  const box = page.getByLabel('أضف تعليقاً').first();
  await box.fill('تعليق قياس تباين — يُحذف فوراً.');
  // The composer is not wrapped in a <form>; the send button is a sibling.
  await page.getByRole('button', { name: /انشر التعليق/ }).first().click();
  await page.getByRole('button', { name: /حذف/ }).first().click();
  await expect(page.locator(CONFIRM)).toBeVisible();
}

async function dismiss(page: Page): Promise<void> {
  await page.locator(CONFIRM).getByRole('button', { name: 'حذف' }).click();
  await expect(page.locator(CONFIRM)).toHaveCount(0);
}

async function failures(
  page: Page,
  selector: string,
): Promise<Array<{ ratio: number; need: number; txt: string; fg: string; bg: string }>> {
  return page.evaluate((sel) => {
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
    // The dark `--card` is a linear-gradient, so the panel has no background
    // COLOUR at all — resolving stops is not an optimisation here, it is the
    // difference between measuring the panel and measuring the page behind it.
    const stopsOf = (img: string): number[][] | null => {
      if (!img || img === 'none' || /url\(/.test(img)) return null;
      const toks = img.match(/(rgba?\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]{3,8})/gi) ?? [];
      const cols = toks.map(rgbOf).filter((c) => c[3] >= 0.999);
      return cols.length ? cols : null;
    };

    const host = document.querySelector(sel)!;
    const out: Array<{ ratio: number; need: number; txt: string; fg: string; bg: string }> = [];
    [host, ...host.querySelectorAll('*')].forEach((el) => {
      // NOT leaf-only. A row that holds an <Icon> AND its own bare text node is
      // a real pattern here (the toasts are exactly that shape), and skipping
      // any element with children silently reports it as unmeasured.
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .trim();
      const t = el.children.length === 0 ? (el.textContent ?? '').trim() : own;
      if (!t) return;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return;
      if (el.closest('[disabled],[aria-disabled="true"],[aria-hidden="true"]')) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;

      const stack: number[][] = [];
      let n: Element | null = el;
      let gradient: number[][] | null = null;
      while (n) {
        const cs = getComputedStyle(n);
        const c = rgbOf(cs.backgroundColor);
        if (c[3] > 0.001) {
          stack.push(c);
          if (c[3] >= 0.999) break;
        }
        const g = stopsOf(cs.backgroundImage);
        if (g) {
          gradient = g;
          break;
        }
        n = n.parentElement;
      }
      const flatten = (base: number[]): number[] => {
        let bg = base.slice(0, 3);
        for (let i = stack.length - 1; i >= 0; i--) {
          const l = stack[i];
          bg = [0, 1, 2].map((k) => Math.round(l[k] * l[3] + bg[k] * (1 - l[3])));
        }
        return bg;
      };
      const grounds: number[][] = [];
      const rootBg = rgbOf(getComputedStyle(document.documentElement).backgroundColor);
      if (gradient) for (const g of gradient) grounds.push(flatten(g));
      else if (stack.length && stack[stack.length - 1][3] >= 0.999) grounds.push(flatten(stack.pop()!));
      else grounds.push(flatten(rootBg[3] >= 0.999 ? rootBg : [255, 255, 255, 1]));

      const size = parseFloat(s.fontSize);
      const need = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700) ? 3 : 4.5;
      const raw = rgbOf(s.color);
      const a = raw[3] * parseFloat(s.opacity || '1');
      let got = Infinity;
      let bg = grounds[0];
      let fg = grounds[0];
      for (const gr of grounds) {
        const f = [0, 1, 2].map((k) => Math.round(raw[k] * a + gr[k] * (1 - a)));
        const rr = ratio(f, gr);
        if (rr < got) {
          got = rr;
          bg = gr;
          fg = f;
        }
      }
      if (got < need) {
        out.push({ ratio: +got.toFixed(2), need, txt: t.slice(0, 34), fg: `rgb(${fg.join(',')})`, bg: `rgb(${bg.join(',')})` });
      }
    });
    return out;
  }, selector);
}

for (const theme of ['light', 'dark'] as const) {
  test(`O1 (${theme}): the shared confirm dialog reads at AA`, async ({ page }) => {
    await signIn(page);
    await openDeleteConfirm(page, theme);
    const fails = await failures(page, CONFIRM);
    expect(
      fails.map((f) => `  ${f.ratio}<${f.need} "${f.txt}" ${f.fg} on ${f.bg}`).join('\n'),
    ).toEqual('');
    await dismiss(page);
  });
}

test('O3: the creator dashboard has a provider, and it is the styled dialog', async ({ page }) => {
  // A different failure with the same root: this surface mounted no provider at
  // all, so `useConfirm` fell through to native `window.confirm` and `useToast`
  // to a silent no-op. A native dialog is invisible to a contrast sampler — it
  // would score a clean zero while the creator looks at an LTR browser box — so
  // the assertion that no dialog fires is doing more work than the ratios.
  //
  // The dashboard carries no `data-theme` and none of the ventures variables,
  // so the overlays reach their colours through the fallback chain in
  // wathba-feedback.tsx. That chain is what the computed values below check.
  await signIn(page);
  const { projectId } = seededIds();
  const natives: string[] = [];
  page.on('dialog', (d) => {
    natives.push(d.message());
    void d.dismiss();
  });

  // The story editor's revert is the one confirm call site that touches nothing
  // — it needs the textarea dirty, and reverting is local state.
  await page.goto(`/projects/dashboard/${projectId}/story`);
  const ta = page.locator('textarea').first();
  await ta.fill(`${await ta.inputValue()}\nسطر قياس.`);
  await page.getByRole('button', { name: /تراجع/ }).first().click();
  await expect(page.locator(CONFIRM)).toBeVisible();

  expect(natives, 'a native window.confirm means the provider is not mounted').toEqual([]);
  const fails = await failures(page, CONFIRM);
  expect(
    fails.map((f) => `  ${f.ratio}<${f.need} "${f.txt}" ${f.fg} on ${f.bg}`).join('\n'),
  ).toEqual('');

  const t = await page.evaluate(() => {
    const d = document.querySelector('[role="alertdialog"]')!;
    const cs = getComputedStyle(d);
    return {
      background: cs.backgroundColor,
      color: cs.color,
      // `rgba(var(--ink-rgb, 18,33,26),.1)` — the fallback is everything after
      // the FIRST comma, so this one var() supplies all three channels. If that
      // ever stops parsing, the border silently goes transparent.
      border: cs.borderTopColor,
      // Inside the shell div, so it inherits RTL and the Arabic face.
      direction: cs.direction,
    };
  });
  expect(t.background).toBe('rgb(255, 255, 255)'); // --bg-elevated
  expect(t.color).toBe('rgb(22, 32, 27)'); // --text-primary
  expect(t.border).toBe('rgba(18, 33, 26, 0.1)');
  expect(t.direction).toBe('rtl');

  await page.locator(CONFIRM).getByRole('button', { name: 'إلغاء' }).click();
});

test('O2: the overlays render INSIDE the themed element', async ({ page }) => {
  // The one that matters. The ratios in O1 are a consequence; this is the
  // cause. If a refactor lifts WathbaFeedbackProvider back out of the themed
  // div — or drops another overlay outside it — every token below silently
  // becomes an empty string again and the dialog loses its panel.
  await signIn(page);
  await openDeleteConfirm(page, 'light');
  const t = await page.evaluate(() => {
    const dialog = document.querySelector('[role="alertdialog"]')!;
    const themed = document.querySelector('[data-pillar="ventures"]')!;
    const cs = getComputedStyle(dialog);
    const get = (n: string): string => cs.getPropertyValue(n).trim();
    return {
      inside: themed.contains(dialog),
      // The scrim must still resolve against the viewport. Nothing on the
      // themed div creates a containing block today (no transform, filter or
      // contain), and adding one would trap the overlay inside the page box.
      scrimPosition: getComputedStyle(dialog.parentElement!).position,
      card: get('--card'),
      text: get('--text'),
      muted: get('--muted'),
      grad: get('--grad'),
      onAccent: get('--on-accent'),
    };
  });
  expect(t.inside).toBe(true);
  expect(t.scrimPosition).toBe('fixed');
  // Empty strings are the failure mode — an unresolved var() is not an error,
  // it just paints nothing.
  for (const [name, value] of Object.entries(t)) {
    if (name === 'inside' || name === 'scrimPosition') continue;
    expect(value, `${name} must resolve inside the overlay`).not.toBe('');
  }
  // The non-danger confirm button is built from these two and its only call
  // site needs a pledge this account does not have, so it is verified by
  // construction rather than by measurement.
  expect(t.grad).toContain('#05c074');
  expect(t.onAccent.toLowerCase()).toBe('#08130d');
  await dismiss(page);
});
