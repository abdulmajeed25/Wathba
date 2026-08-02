import { expect, test } from '@playwright/test';

/**
 * The supporter-ranks page must promise only what the platform delivers, and
 * must not call a paid tier a partnership.
 *
 * Two problems it had. The top tier was «شريك مؤسس» — "شريك" means PARTNER, and
 * a partner tier bought with money reads as an equity stake in Wathba. And the
 * ladder advertised perks with no system behind them: virtual meetups with
 * creators, invitations to Wathba events, a name on a founders' wall,
 * consultations with the Wathba team, founder-exclusive merchandise, early
 * access to limited rewards. Those were printed next to a price.
 *
 * The assertions are deliberately about the RENDERED page, not the data module:
 * the risk is what a reader is shown, and a future change could reach the page
 * through some other source.
 */

/** Every perk removed for having no system behind it. */
const PHANTOM = [
  'لقاءات افتراضية مع المبدعين',
  'دعوات لفعاليات وثبة الحصرية',
  'اسمك في «جدار المؤسسين»',
  'استشارات مع فريق وثبة',
  'منتجات حصرية للمؤسسين',
  'وصول مبكر لمكافآت محدودة',
];

test('K1: the top tier is a SUPPORTER, never a partner', async ({ page }) => {
  await page.goto('/projects/ranks');
  const top = page.getByTestId('wathba-rank-card-r5');
  await expect(top).toBeVisible();
  await expect(top).toContainText('داعم مؤسس');
  await expect(top).toContainText('FOUNDING SUPPORTER');

  // «شريك» is the word that carries the legal implication. It must not appear
  // anywhere on a page whose subject is what you get for paying.
  const body = (await page.locator('body').innerText()).replace(/‏|‎/g, '');
  expect(body, 'the ranks page still calls a paid tier a partner').not.toContain('شريك');
  expect(body, 'the retired English label is still rendered').not.toContain('FOUNDER');
});

test('K2: no tier advertises a perk the platform cannot deliver', async ({ page }) => {
  await page.goto('/projects/ranks');
  const cards = page.locator('[data-testid^="wathba-rank-card-"]');
  await expect(cards).toHaveCount(5);

  // Inside the CARDS specifically — the «قريباً» block below may legitimately
  // name some of these, which is the whole point of separating them.
  const inCards = await cards.allInnerTexts();
  const joined = inCards.join('\n');
  for (const phantom of PHANTOM) {
    expect(joined, `a rank card still promises «${phantom}»`).not.toContain(phantom);
  }

  // Thresholds are unchanged — this was a copy fix, not a re-pricing.
  await expect(page.getByTestId('wathba-rank-card-r1')).toContainText('أول دعم');
  await expect(page.getByTestId('wathba-rank-card-r3')).toContainText('١٬٠٠٠+ ر.س');
  await expect(page.getByTestId('wathba-rank-card-r5')).toContainText('١٠٬٠٠٠+ ر.س');
});

test('K3: aspirational items are shown as «قريباً» and kept out of the ladder', async ({ page }) => {
  await page.goto('/projects/ranks');
  const soon = page.getByTestId('wathba-ranks-soon');
  await expect(soon).toBeVisible();
  await expect(soon).toContainText('قريباً');
  // It must say plainly that these are not current perks — a heading alone
  // leaves "soon" to do too much work.
  await expect(soon).toContainText('ليست جزءاً من مزايا الرتب الحالية');
  await expect(soon).toContainText('لقاءات افتراضية مع المبدعين');
});

test('K4: the page says what a rank is, and that it is not a creator reward', async ({ page }) => {
  await page.goto('/projects/ranks');
  const explainer = page.getByTestId('wathba-ranks-explainer');
  await expect(explainer).toBeVisible();
  await expect(explainer).toContainText('ما هي الرتب؟');
  await expect(explainer).toContainText('كيف ترتفع؟');
  // The distinction that was actually confusing people: platform-wide standing
  // versus the rewards a creator offers inside one campaign.
  await expect(explainer).toContainText('على مستوى المنصّة');
  await expect(explainer).toContainText('المكافآت');
});
