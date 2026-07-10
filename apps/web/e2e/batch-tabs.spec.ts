import { expect, test } from '@playwright/test';

import { seededIds } from './helpers';

/**
 * Batch TABS — campaign tab ROUTES (Kickstarter parity): land on the story
 * page, click through all 8 tabs, and assert per-tab URLs, the persistent
 * header (pledge CTA visible throughout), active-tab state and a live badge.
 */

const TAB_ROUTES: Array<{ label: string; path: string }> = [
  { label: 'المكافآت',  path: '/rewards' },
  { label: 'المبدع',    path: '/creator' },
  { label: 'الأسئلة',   path: '/faqs' },
  { label: 'التحديثات', path: '/updates' },
  { label: 'التعليقات', path: '/comments' },
  { label: 'المجتمع',   path: '/community' },
  { label: 'الشفافية',  path: '/transparency' },
  { label: 'الحملة',    path: '' }, // back to the story tab last
];

test('TABS: all 8 tabs are real routes under a persistent campaign shell', async ({ page }) => {
  const { projectId } = seededIds();
  const base = `/projects/${projectId}`;
  await page.goto(base);

  const bar = page.getByTestId('campaign-tabbar');
  await expect(bar).toBeVisible();
  // A live count badge renders in the bar (rewards count from tab-counts).
  await expect(bar.getByTestId('tab-badge-rewards')).toBeVisible();
  // Story tab is the active one on landing.
  await expect(bar.locator('a[aria-current="page"]')).toHaveAttribute('href', base);

  for (const tab of TAB_ROUTES) {
    await bar.getByRole('link', { name: tab.label }).click();
    await page.waitForURL(`**${base}${tab.path}`);
    // Persistent header: the campaign h1 + the pledge CTA never unmount.
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByTestId('tabbar-pledge')).toBeVisible();
    // Active-tab state follows the route.
    await expect(bar.locator('a[aria-current="page"]')).toHaveAttribute(
      'href',
      `${base}${tab.path === '' ? '' : tab.path}`,
    );
  }
});

test('TABS: sub-tab routes carry their own titles and the story keeps its canonical', async ({ page }) => {
  const { projectId } = seededIds();
  await page.goto(`/projects/${projectId}/rewards`);
  await expect(page).toHaveTitle(/المكافآت · .+ · وثبة/);
  await page.goto(`/projects/${projectId}`);
  await expect(page).toHaveTitle(/^(?!المكافآت).+وثبة$/);
});
