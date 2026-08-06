/**
 * HOME-REVIEW O4 — the discovery tree, and the one URL space it lives in.
 *
 * The audit recorded the tree as "hover-only": ~200 category and subcategory
 * URLs declared in sitemap.ts, zero of them in server-rendered HTML, reachable
 * only by hovering the mega-menu. Re-measuring it turned up something the
 * hover framing had hidden — there were TWO category URL spaces:
 *
 *   /projects/category/<slug>   linked from the homepage, NOT in the sitemap,
 *                               self-canonical, titled «فئة art» (the raw
 *                               English slug, while its own h1 said «فنون»)
 *   /projects/discover/<slug>   in the sitemap, linked from NO server-rendered
 *                               page, self-canonical, and already rendering
 *                               its subcategories server-side
 *
 * So the tree was not merely hard to crawl; the site linked one space while the
 * sitemap advertised the other, and each declared itself canonical. The project
 * had already decided which one wins — commit 607f810, "nav consolidation —
 * «اكتشف» is THE discovery entry" — and /projects/category/[id] survives only
 * from the original import commit.
 *
 * Worse, the homepage chips were not the taxonomy at all: they came from the
 * bundled `wathbaCategories` fixture, including its invented counts («٨٤٢
 * مشروع»), and two of the eight slugs did not exist. `film` and `tech` are
 * `film-video` and `technology` in the live taxonomy, so /projects/discover/film
 * answered 200 with no <h1> — an empty page behind a homepage chip.
 *
 * This module is the single place that turns a live category into a link, so
 * the homepage and the discovery page cannot drift apart again.
 */

/** The slice of ApiCategoryNode any category link needs. */
export interface HomeCategory {
  slug: string;
  nameAr: string;
  liveCount: number;
}

/** The canonical category URL. There is exactly one. */
export function categoryHref(slug: string): string {
  return `/projects/discover/${slug}`;
}

/**
 * Icon per top-level slug.
 *
 * Presentation only — never a source of names, counts or slugs, all of which
 * come from the API.
 *
 * EVERY VALUE HERE MUST EXIST IN ICON_MAP in wathba-icons.tsx. That component
 * resolves `ICON_MAP[name] ?? AlertCircle`, so an invented name does not fall
 * back to something neutral — it renders a warning triangle. The first draft of
 * this map used the Material Symbols names the fixture implied (`agriculture`,
 * `handyman`, `eco`, `checkroom`, `museum`, `newspaper`, `sports_soccer`,
 * `theater_comedy`, `travel_explore`) and nine of twenty-one categories drew a
 * "!" on the homepage.
 *
 * Slugs with no honest match are deliberately ABSENT and take the neutral
 * `category` default, which is a real icon. A weak metaphor (a gift box for
 * «الحِرَف») reads as a mistake; a neutral one reads as a category.
 */
const ICONS: Record<string, string> = {
  art: 'palette',
  comics: 'auto_stories',
  dance: 'music_note',
  design: 'design_services',
  'digital-economy': 'currency_exchange',
  'environment-sustainability': 'public',
  'film-video': 'movie',
  food: 'restaurant',
  games: 'sports_esports',
  'heritage-culture': 'account_balance',
  journalism: 'campaign',
  photography: 'photo_camera',
  publishing: 'menu_book',
  'social-impact': 'volunteer_activism',
  sports: 'emoji_events',
  technology: 'memory',
  'tourism-entertainment': 'explore',
};

export function categoryIcon(slug: string): string {
  return ICONS[slug] ?? 'category';
}

/**
 * Arabic-Indic digits, because that is what this row already showed.
 *
 * The fixture carried pre-formatted strings («٨٤٢ مشروع»), so swapping in a
 * live `liveCount` silently changed the row to Latin digits — the platform is
 * already inconsistent between surfaces (the hero uses Latin), and the rule
 * that matters is not mixing systems WITHIN one. Formatted through Intl with an
 * explicit numbering system rather than by substituting code points.
 */
const arabicDigits = new Intl.NumberFormat('ar-EG-u-nu-arab');

export function categoryCount(liveCount: number): string {
  return `${arabicDigits.format(liveCount)} مشروع`;
}
