import { expect, test } from '@playwright/test';

/**
 * Batch POLISH Unit 4 — the dark theme, verified by measurement.
 *
 * The old dark theme had two defects that a screenshot review would call
 * "fine": its accent was '#22d3ee' — CYAN, so Wathba's green identity vanished
 * at night — and its muted hint token scored 2.16:1, failing WCAG 1.4.3. Both
 * are the kind of thing only arithmetic catches, so these tests do arithmetic.
 */

/** WCAG 2.x relative luminance + contrast ratio. */
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const lum = ([r, g, b2]: [number, number, number]) => {
    const f = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b2);
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function parseRgb(s: string): [number, number, number] {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`not a colour: ${s}`);
  const [r, g, b] = m[1]!.split(',').map((n) => parseFloat(n));
  return [r!, g!, b!];
}

/** Flip the public site into dark mode through its own toggle. */
async function goDark(page: import('@playwright/test').Page) {
  await page.goto('/projects');
  const root = page.locator('[data-theme]').first();
  if ((await root.getAttribute('data-theme')) !== 'dark') {
    await page.getByTitle('تبديل النمط').click();
  }
  await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();
  // The shell animates `background .4s, color .4s`. Sampling immediately after
  // the toggle reads values captured MID-TRANSITION — both foreground and
  // background land on near-identical mid greys and every contrast check
  // "fails" for a reason that has nothing to do with the palette. Wait it out.
  await page.waitForTimeout(700);
}

test('D1: the brand stays GREEN in dark mode', async ({ page }) => {
  await goDark(page);

  const accent = await page.evaluate(() => {
    const el = document.querySelector('[data-theme="dark"]') as HTMLElement;
    return getComputedStyle(el).getPropertyValue('--accent').trim();
  });

  // Parse the hex and assert green dominates. The old value #22d3ee had
  // blue (238) above green (211) — that is a cyan, and this test would have
  // caught it the day it shipped.
  const m = accent.match(/^#?([0-9a-f]{6})$/i);
  expect(m, `--accent should be a hex, got "${accent}"`).not.toBeNull();
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m![1]!.slice(i, i + 2), 16)) as [number, number, number];

  expect(g, 'green must be the dominant channel').toBeGreaterThan(r);
  expect(g, 'green must beat blue — a cyan accent is not the Wathba brand').toBeGreaterThan(b);
  expect(g - b, 'green must beat blue by a clear margin, not a rounding error').toBeGreaterThan(40);
});

test('D2: elevation means lightness — every layer is lighter than the one below', async ({ page }) => {
  await goDark(page);

  const layers = await page.evaluate(() => {
    const el = document.querySelector('[data-theme="dark"]') as HTMLElement;
    const cs = getComputedStyle(el);
    return (['--surface-0', '--surface-1', '--surface-2', '--surface-3'] as const).map((n) =>
      cs.getPropertyValue(n).trim(),
    );
  });

  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    return [0, 2, 4].reduce((a, i) => a + parseInt(h.slice(i, i + 2), 16), 0);
  };

  expect(layers.every(Boolean), `all four layers must be defined, got ${layers.join(', ')}`).toBe(true);
  for (let i = 1; i < layers.length; i++) {
    expect(
      lum(layers[i]!),
      `--surface-${i} (${layers[i]}) must be lighter than --surface-${i - 1} (${layers[i - 1]})`,
    ).toBeGreaterThan(lum(layers[i - 1]!));
  }
});

test('D3: dark surfaces are WARM, not blue-black', async ({ page }) => {
  await goDark(page);

  const surfaces = await page.evaluate(() => {
    const el = document.querySelector('[data-theme="dark"]') as HTMLElement;
    const cs = getComputedStyle(el);
    return (['--surface-0', '--surface-1', '--surface-2', '--surface-3'] as const).map((n) =>
      cs.getPropertyValue(n).trim(),
    );
  });

  for (const hex of surfaces) {
    const h = hex.replace('#', '');
    const [r, , b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    // Warm = red at least as strong as blue. The palette this replaces had
    // #0a1422: blue 34, red 10 — cold by a factor of three.
    expect(r!, `${hex} should be warm (red >= blue)`).toBeGreaterThanOrEqual(b!);
  }
});

test('D4: real rendered text clears WCAG 1.4.3 on the dark theme', async ({ page }) => {
  await goDark(page);

  // Sample actual painted elements, not tokens: this catches a component that
  // hardcodes a colour the token system never sees.
  const samples = await page.evaluate(() => {
    const out: Array<{ tag: string; fg: string; bg: string; size: number; weight: string; text: string }> = [];
    // Resolve the EFFECTIVE background by alpha-compositing up the ancestor
    // chain. Naively taking the first non-transparent backgroundColor is wrong:
    // Chrome reports the SPECIFIED value, so a card painted
    // rgba(255,252,245,.06) over a dark surface reads back as near-white and
    // the contrast maths comes out nonsense. Layers must be composited.
    const bgOf = (el: Element): string => {
      const stack: Array<[number, number, number, number]> = [];
      let n: Element | null = el;
      while (n) {
        const cs2 = getComputedStyle(n);
        // A gradient fill (our CTAs are painted var(--cta-grad)) reports
        // backgroundColor: transparent, so a naive walk sails past the button
        // and compares its label against the page ground — every accent button
        // then "fails" at ~1:1. Read the gradient's own stops and treat the
        // first as an opaque layer.
        const grad = cs2.backgroundImage?.match(/rgba?\(([^)]+)\)/);
        if (grad && /gradient/.test(cs2.backgroundImage)) {
          const gp = grad[1]!.split(',').map((x) => parseFloat(x));
          stack.push([gp[0]!, gp[1]!, gp[2]!, gp.length > 3 ? gp[3]! : 1]);
          break;
        }
        const c = cs2.backgroundColor;
        const m = c?.match(/rgba?\(([^)]+)\)/);
        if (m) {
          const parts = m[1]!.split(',').map((x) => parseFloat(x));
          const a = parts.length > 3 ? parts[3]! : 1;
          if (a > 0) {
            stack.push([parts[0]!, parts[1]!, parts[2]!, a]);
            if (a >= 0.999) break; // fully opaque: nothing below it matters
          }
        }
        n = n.parentElement;
      }
      // The page ground, in case every ancestor was translucent.
      stack.push([19, 18, 16, 1]);
      // Composite bottom-up: the deepest layer is last in `stack`.
      let [r, g, b2] = stack[stack.length - 1]!;
      for (let i = stack.length - 2; i >= 0; i--) {
        const [sr, sg, sb, sa] = stack[i]!;
        r = sr * sa + r * (1 - sa);
        g = sg * sa + g * (1 - sa);
        b2 = sb * sa + b2 * (1 - sa);
      }
      return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b2)})`;
    };
    document.querySelectorAll('main p, main h1, main h2, main h3, main a, main span, main div').forEach((el) => {
      const text = (el.textContent ?? '').trim();
      if (!text || text.length < 2 || el.children.length > 0) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.5) return;
      // background-clip: text means the GRADIENT IS THE GLYPHS — there is no
      // "text colour on a background" to compare, and `color` is only the
      // fallback for browsers without the clip. Measuring it compares two
      // unrelated values. (Wathba's hero headline is painted this way.)
      const clip = cs.backgroundClip || (cs as unknown as Record<string, string>).webkitBackgroundClip;
      if (clip === 'text') return;
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      out.push({
        tag: el.tagName,
        fg: cs.color,
        bg: bgOf(el),
        size: parseFloat(cs.fontSize),
        weight: cs.fontWeight,
        text: text.slice(0, 34),
      });
    });
    return out.slice(0, 220);
  });

  expect(samples.length, 'nothing sampled — the page did not render').toBeGreaterThan(20);

  const failures = samples
    .map((s) => {
      const large = s.size >= 24 || (s.size >= 18.66 && Number(s.weight) >= 700);
      const need = large ? 3 : 4.5;
      const ratio = contrast(parseRgb(s.fg), parseRgb(s.bg));
      return { ...s, need, ratio, large };
    })
    .filter((s) => s.ratio < s.need);

  expect(
    failures,
    `dark-mode contrast failures:\n${failures
      .map((f) => `  ${f.ratio.toFixed(2)} < ${f.need}  ${f.tag} ${f.size}px  "${f.text}"  ${f.fg} on ${f.bg}`)
      .join('\n')}`,
  ).toEqual([]);
});

test('D5: the ops surface uses the SAME warm dark system, not GitHub blue-black', async ({ page }) => {
  // The Ops Center was painted with a hardcoded GitHub-dark palette, so at night
  // it looked like a different product. It now resolves to the same tokens.
  const res = await page.goto('/ops');
  // Unauthenticated is fine — this asserts the theme layer, and the sign-in
  // redirect target is still inside the ops root on a failed probe.
  expect(res?.status()).toBeLessThan(500);

  const css = await page.evaluate(async () => {
    const sheets = Array.from(document.styleSheets);
    let text = '';
    for (const sh of sheets) {
      try {
        text += Array.from(sh.cssRules).map((r) => r.cssText).join('\n');
      } catch {
        /* cross-origin sheet — skip */
      }
    }
    return text;
  });

  // The remap must exist and must define the warm ramp.
  expect(css, 'the ops dark remap is missing').toContain('--ops-surface-0');
  expect(css.toLowerCase(), 'the ops canvas should be the warm near-black').toContain('#131210');
});
