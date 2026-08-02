import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * Nothing a reader can BUY may call them a partner.
 *
 * «شريك» means partner, and a tier bought with money that uses the word reads as
 * an equity claim. It appeared twice: the top supporter rank («شريك مؤسس»,
 * renamed to «داعم مؤسس») and a 399 ر.س campaign reward that offered
 * «اسمك كـ"شريك" في الصفحة».
 *
 * The word is NOT banned from the codebase, and that distinction is the whole
 * point of this test. Wathba really does co-invest in some ventures, and four
 * uses describe that real equity position — the two platform-partner
 * disclosures, the «بشراكة وثبة» clause in the terms, and the ops
 * `stakeType: 'co-founder'` label. Removing those would misstate the business
 * rather than protect it.
 *
 * So the scan is narrow by construction: it reads only the arrays that list
 * what someone RECEIVES. A disclosure lives in `body:` / `disclosureAr:` /
 * `labelAr:`, so it is out of range no matter how it is worded.
 *
 * `items:` alone is NOT a safe signal, and assuming it was is how the first
 * version of this test failed: it flagged a project's process list —
 * «نجمع البلاستيك مع شريكنا «بحر نظيف» في صفاقس» — where the partner is the
 * creator's plastics supplier and nobody is buying anything. A reward tier is
 * identified by the `price:` that precedes its `items:`, which is exactly the
 * thing that makes a list purchasable.
 */

/** A reward tier: `items:` that belongs to an object carrying a `price:`. */
const REWARD_ITEMS = /price\s*:\s*\d[\s\S]{0,400}?\bitems\s*:\s*\[([^\]]*)\]/g;
/** A rank tier: every `perks:` array is by definition something you climb to. */
const RANK_PERKS = /\bperks\s*:\s*\[([^\]]*)\]/g;
const PARTNER = 'شريك';

test('P1: no rank perk or reward item calls the buyer a partner', () => {
  const SRC = join(__dirname, '..', 'src');
  const offenders: string[] = [];

  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules') continue;
        walk(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const src = readFileSync(p, 'utf8');
      for (const pattern of [REWARD_ITEMS, RANK_PERKS]) {
        for (const m of src.matchAll(pattern)) {
          const list = m[1];
          if (!list?.includes(PARTNER)) continue;
          // Report the offending entry, not the whole array.
          const entry = list
            .split(',')
            .map((s) => s.trim())
            .find((s) => s.includes(PARTNER));
          const line = src.slice(0, (m.index ?? 0) + m[0].indexOf(entry ?? '')).split('\n').length;
          offenders.push(`${relative(SRC, p)}:${line}  ${entry}`);
        }
      }
    }
  };
  walk(SRC);

  expect(
    offenders,
    `a purchasable tier implies partnership — the word belongs only to Wathba's own co-investment:\n  ${offenders.join('\n  ')}`,
  ).toEqual([]);
});
