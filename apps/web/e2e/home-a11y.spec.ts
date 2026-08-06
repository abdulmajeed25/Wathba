import { expect, test } from '@playwright/test';

/**
 * The homepage's accessibility contract.
 *
 * Three of these were real; a fourth — a contrast failure on the giant
 * «٠١ ٠٢ ٠٣» step watermarks — was NOT, and the exemption is encoded here on
 * purpose. Those numerals are aria-hidden decoration: WCAG 1.4.3 exempts them,
 * and a checker that flags them teaches the next reader to "fix" intentional
 * design. The exemption belongs in the test, not in a comment nobody reads.
 */

async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, 0);
  });
}

test('A1: the heading outline never skips a level', async ({ page }) => {
  await page.goto('/projects');
  await settle(page);

  const { skips, h1Count } = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(
      (h) => h.getClientRects().length,
    );
    const levels = vis.map((h) => Number(h.tagName[1]));
    const skips: string[] = [];
    for (let i = 1; i < levels.length; i++) {
      if (levels[i]! - levels[i - 1]! > 1) {
        skips.push(`h${levels[i - 1]}→h${levels[i]} at "${(vis[i]!.textContent || '').trim().slice(0, 30)}"`);
      }
    }
    return { skips, h1Count: levels.filter((l) => l === 1).length };
  });

  // The hero slide title used to be an h3 sitting directly under the page h1,
  // so the very first entry in a screen reader's heading list skipped a level.
  expect(skips, 'heading levels that jump').toEqual([]);
  expect(h1Count, 'exactly one h1 per page').toBe(1);
});

test('A2: every interactive target clears 24px', async ({ page }) => {
  await page.goto('/projects');
  await settle(page);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main a, main button')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.height < 24 || r.width < 24))
      .map(({ el, r }) => `${(el.textContent || '').trim().slice(0, 24)} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  // WCAG 2.5.8 (AA). The magazine banner links sat in a 20px line box.
  expect(small, 'targets under 24px').toEqual([]);
});

test('A3: text meets contrast — with decoration correctly exempt', async ({ page }) => {
  await page.goto('/projects');
  await settle(page);

  const result = await page.evaluate(() => {
    const parse = (c: string) => {
      const m = c.match(/[\d.]+/g)!.map(Number);
      return { r: m[0]!, g: m[1]!, b: m[2]!, a: m.length > 3 ? m[3]! : 1 };
    };
    type C = { r: number; g: number; b: number; a: number };
    const over = (f: C, bg: C): C => ({
      r: f.r * f.a + bg.r * (1 - f.a), g: f.g * f.a + bg.g * (1 - f.a),
      b: f.b * f.a + bg.b * (1 - f.a), a: 1,
    });
    const lum = (c: C) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (x: C, y: C) => {
      const A = lum(x), B = lum(y);
      return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
    };
    // Composite every ancestor background over white. Reading a translucent
    // background as if it were opaque is how a passing 7:1 gets reported as a
    // failing 2.2:1 — this audit made exactly that mistake once.
    const effBg = (el: Element): C => {
      const stack: C[] = [];
      let n: Element | null = el;
      while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.a > 0) stack.push(c);
        n = n.parentElement;
      }
      let base: C = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i]!, base);
      return base;
    };

    const failures: string[] = [];
    let exempt = 0;
    document.querySelectorAll('main *').forEach((el) => {
      const text = (el.textContent || '').trim();
      if (!text || el.children.length || !el.getClientRects().length) return;
      // Decorative text is out of scope for 1.4.3 — see the file header.
      if (el.closest('[aria-hidden="true"]')) { exempt++; return; }
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') return;
      const fs = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      const bg = effBg(el);
      const fg = over(parse(cs.color), bg);
      const r = ratio(fg, bg);
      const need = fs >= 24 || (fs >= 18.66 && weight >= 700) ? 3 : 4.5;
      if (r < need) failures.push(`"${text.slice(0, 20)}" ${fs}px ${r.toFixed(2)}:1 (needs ${need})`);
    });
    return { failures, exempt };
  });

  expect(result.failures, 'text below its contrast threshold').toEqual([]);
  // The three step watermarks. If this reaches zero the numerals lost their
  // aria-hidden and are now real text that must actually pass.
  expect(result.exempt, 'decorative numerals should still be aria-hidden').toBeGreaterThan(0);
});

test('A4: no physical direction properties on the homepage', async ({ page }) => {
  // Arabic is RTL, so `right: 11` happens to look correct today and would
  // silently mirror wrong the moment an LTR locale exists. The project's own
  // convention is logical properties; this keeps the homepage honest.
  await page.goto('/projects');
  await settle(page);

  const dir = await page.evaluate(() => getComputedStyle(document.querySelector('[data-pillar]')!).direction);
  expect(dir, 'the pillar is RTL').toBe('rtl');

  // Positions are asserted by outcome: the card chip hugs the reading start and
  // the bookmark the reading end, whatever properties produced them.
  const pos = await page.evaluate(() => {
    const card = document.querySelector('.wathba-pressable');
    if (!card) return null;
    const cr = card.getBoundingClientRect();
    const abs = [...card.querySelectorAll('div')].filter((d) => getComputedStyle(d).position === 'absolute');
    const chip = abs.find((d) => (d.textContent || '').trim().length > 1);
    const icon = abs.find((d) => !(d.textContent || '').trim());
    return {
      chipFromStart: chip ? Math.round(cr.right - chip.getBoundingClientRect().right) : null,
      iconFromEnd: icon ? Math.round(icon.getBoundingClientRect().left - cr.left) : null,
    };
  });
  expect(pos, 'a pressable card should exist').not.toBeNull();
  expect(pos!.chipFromStart, 'category chip hugs the RTL reading start').toBeLessThan(20);
  expect(pos!.iconFromEnd, 'bookmark hugs the RTL reading end').toBeLessThan(20);
});
