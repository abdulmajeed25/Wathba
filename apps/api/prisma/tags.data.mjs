/**
 * Batch DISCOVERY-ENGINE — the starter tag vocabulary.
 *
 * Deliberately CROSS-CUTTING. A tag that means the same thing as a category is
 * a tag that does no work: «ألعاب» is already a category, so tagging a project
 * «ألعاب» adds a second way to say something the taxonomy already says. These
 * are the axes the category tree cannot express — who it is for, what stage it
 * is at, what it is made of, what it is for — so a reader can cut ACROSS
 * categories: «تراث سعودي» spans crafts, film and publishing; «صديق للبيئة»
 * spans food, fashion and hardware.
 *
 * Seeded, not exhaustive. Ops adds to it as real projects arrive; that is what
 * the content.tag.upsert operation is for. Forty is enough to make the facet
 * useful without pretending we know the platform's vocabulary before it has one.
 *
 * `sortOrder` groups them by axis so the ops list reads in a sensible order;
 * the creator typeahead orders by usage instead, so popularity decides what a
 * creator sees first once there is usage to decide it.
 */

/** @type {ReadonlyArray<{slug: string, ar: string, en: string, group: number}>} */
export const TAGS = [
  // ── who it is for ──────────────────────────────────────────────── 100
  { slug: 'for-children', ar: 'للأطفال', en: 'For children', group: 100 },
  { slug: 'for-women', ar: 'للنساء', en: 'For women', group: 100 },
  { slug: 'for-families', ar: 'للعائلات', en: 'For families', group: 100 },
  { slug: 'for-students', ar: 'للطلاب', en: 'For students', group: 100 },
  { slug: 'for-elderly', ar: 'لكبار السن', en: 'For the elderly', group: 100 },
  { slug: 'accessibility', ar: 'إتاحة وذوو الإعاقة', en: 'Accessibility', group: 100 },

  // ── what it is about ───────────────────────────────────────────── 200
  { slug: 'saudi-heritage', ar: 'تراث سعودي', en: 'Saudi heritage', group: 200 },
  { slug: 'arabic-language', ar: 'اللغة العربية', en: 'Arabic language', group: 200 },
  { slug: 'islamic', ar: 'إسلامي', en: 'Islamic', group: 200 },
  { slug: 'desert', ar: 'الصحراء', en: 'Desert', group: 200 },
  { slug: 'sea-coast', ar: 'البحر والسواحل', en: 'Sea and coast', group: 200 },
  { slug: 'agriculture', ar: 'الزراعة', en: 'Agriculture', group: 200 },
  { slug: 'health', ar: 'الصحة', en: 'Health', group: 200 },
  { slug: 'education', ar: 'التعليم', en: 'Education', group: 200 },
  { slug: 'sport', ar: 'الرياضة', en: 'Sport', group: 200 },
  { slug: 'space', ar: 'الفضاء', en: 'Space', group: 200 },

  // ── how it is made ─────────────────────────────────────────────── 300
  { slug: 'handmade', ar: 'صناعة يدوية', en: 'Handmade', group: 300 },
  { slug: 'made-in-saudi', ar: 'صنع في السعودية', en: 'Made in Saudi Arabia', group: 300 },
  { slug: 'eco-friendly', ar: 'صديق للبيئة', en: 'Eco-friendly', group: 300 },
  { slug: 'recycled', ar: 'مواد معاد تدويرها', en: 'Recycled materials', group: 300 },
  { slug: 'open-source', ar: 'مفتوح المصدر', en: 'Open source', group: 300 },
  { slug: 'limited-edition', ar: 'إصدار محدود', en: 'Limited edition', group: 300 },

  // ── stage and shape ────────────────────────────────────────────── 400
  { slug: 'first-project', ar: 'أول مشروع', en: 'First project', group: 400 },
  { slug: 'prototype-ready', ar: 'نموذج أولي جاهز', en: 'Prototype ready', group: 400 },
  { slug: 'in-production', ar: 'قيد التصنيع', en: 'In production', group: 400 },
  { slug: 'series', ar: 'سلسلة', en: 'Series', group: 400 },
  { slug: 'documentary', ar: 'وثائقي', en: 'Documentary', group: 400 },
  { slug: 'workshop', ar: 'ورشة عمل', en: 'Workshop', group: 400 },

  // ── who is behind it ───────────────────────────────────────────── 500
  { slug: 'youth-led', ar: 'بقيادة شباب', en: 'Youth-led', group: 500 },
  { slug: 'women-led', ar: 'بقيادة نساء', en: 'Women-led', group: 500 },
  { slug: 'family-business', ar: 'عمل عائلي', en: 'Family business', group: 500 },
  { slug: 'nonprofit', ar: 'غير ربحي', en: 'Non-profit', group: 500 },
  { slug: 'cooperative', ar: 'تعاونية', en: 'Cooperative', group: 500 },

  // ── where ──────────────────────────────────────────────────────── 600
  { slug: 'rural', ar: 'ريفي', en: 'Rural', group: 600 },
  { slug: 'neighbourhood', ar: 'حيّ ومجتمع محلي', en: 'Neighbourhood', group: 600 },

  // ── what it gives back ─────────────────────────────────────────── 700
  { slug: 'social-impact', ar: 'أثر اجتماعي', en: 'Social impact', group: 700 },
  { slug: 'job-creation', ar: 'خلق وظائف', en: 'Job creation', group: 700 },
  { slug: 'preserves-craft', ar: 'يحفظ حرفة', en: 'Preserves a craft', group: 700 },
  { slug: 'research', ar: 'بحث علمي', en: 'Research', group: 700 },
  { slug: 'vision-2030', ar: 'رؤية ٢٠٣٠', en: 'Vision 2030', group: 700 },
];
