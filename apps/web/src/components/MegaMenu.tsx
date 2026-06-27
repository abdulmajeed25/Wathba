'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown, ChevronLeft, Cpu, Palette, Gamepad2, Film, Music, Utensils, BookOpen, Shirt,
  Sparkles, Clock, TrendingUp, Star, Award, CheckCircle,
} from 'lucide-react';
import { Ph } from './Ph';
import { ProgressBar } from './ProgressBar';
import { categories, trendingProjects } from '@/data/mock';
import { toArabicDigits } from '@wathba/types';

const CAT_ICONS = {
  cpu: Cpu, palette: Palette, gamepad2: Gamepad2, film: Film, music: Music,
  utensils: Utensils, 'book-open': BookOpen, shirt: Shirt,
} as const;

const FILTERS = [
  { id: 'all',    icon: Sparkles,    label: 'الكل' },
  { id: 'live',   icon: TrendingUp,  label: 'نشطة الآن' },
  { id: 'new',    icon: Clock,       label: 'مضافة حديثاً' },
  { id: 'funded', icon: Star,        label: 'مُموَّلة بالكامل' },
  { id: 'near',   icon: Award,       label: 'قاربت الاكتمال' },
  { id: 'top',    icon: CheckCircle, label: 'الأكثر شعبية' },
];

/**
 * "الفئات" hover-dropdown. Design line 105–165:
 *   max-w 1320 + 4-column grid: 208 (rail) | 1fr (subs) | 224 (filter) | 300 (featured).
 *   Hover-triggered. Card var(--card), 1px border, no top-border, bottom radius 22.
 *   Click-through routes to /explore?cat=ID.
 */
export function MegaMenu() {
  const [open, setOpen] = useState(false);
  const [hoverCat, setHoverCat] = useState(categories[0]!.id);
  const cat = categories.find((c) => c.id === hoverCat) ?? categories[0]!;
  const Icon = CAT_ICONS[cat.icon as keyof typeof CAT_ICONS];
  const featured = trendingProjects[1] ?? trendingProjects[0]!;
  const featPct = Math.round((featured.raisedHalalas / featured.goalHalalas) * 100);

  // synthesize 8 sub-categories per top-level category (design doesn't enumerate ours)
  const subsByCat: Record<string, string[]> = {
    TECH:       ['أجهزة', 'تطبيقات', 'روبوتات', 'إنترنت الأشياء', 'ارتداءات ذكية', 'واقع افتراضي', 'طاقة', 'فضاء'],
    DESIGN:     ['منتجات', 'أثاث', 'تغليف', 'هوية', 'إعلانات', 'أزياء', 'فن رقمي', 'خزف'],
    FILM:       ['روائي', 'وثائقي', 'قصير', 'رسوم متحركة', 'خيال علمي', 'كوميديا', 'دراما', 'تجريبي'],
    MUSIC:      ['عربي', 'إلكتروني', 'روك', 'هيب هوب', 'كلاسيكي', 'جاز', 'بوب', 'عالمي'],
    FOOD:       ['مطاعم', 'حلويات', 'مشروبات', 'كافيهات', 'كتب طبخ', 'صلصات', 'ضيافة', 'مأكولات صحية'],
    GAMES:      ['ألعاب طاولة', 'فيديو', 'بطاقات', 'أحجية', 'ألعاب أدوار', 'موبايل', 'أجهزة لعب', 'ألعاب تعليمية'],
    PUBLISHING: ['كتب', 'قصص أطفال', 'مجلات', 'صحافة', 'كتب صوتية', 'بودكاست', 'مذكرات', 'ترجمات'],
    FASHION:    ['أزياء عربية', 'حقائب', 'مجوهرات', 'أحذية', 'ساعات', 'إكسسوارات', 'أطفال', 'رياضي'],
  };
  const subs = subsByCat[cat.id] ?? [];

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="relative inline-flex"
    >
      <Link
        href="/explore"
        className="navlink flex cursor-pointer items-center gap-[3px]"
      >
        الفئات
        <ChevronDown className="h-[18px] w-[18px] text-muted-2" />
      </Link>

      {open && (
        <div className="absolute top-full left-0 right-0 z-[70] pt-[1px]">
          <div className="mx-[26px] flex justify-center">
            <div
              className="w-full max-w-(--container-app) overflow-hidden rounded-b-[22px] border"
              style={{
                background: 'var(--card)',
                borderColor: 'rgba(var(--ink-rgb),0.1)',
                borderTop: 'none',
                boxShadow: 'var(--shadow-mega)',
                display: 'grid',
                gridTemplateColumns: '208px 1fr 224px 300px',
              }}
            >
              {/* category rail */}
              <div
                className="border-e py-[18px]"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.07)', background: 'rgba(var(--ink-rgb),0.02)' }}
              >
                {categories.map((c) => {
                  const RowIcon = CAT_ICONS[c.icon as keyof typeof CAT_ICONS];
                  const active = c.id === hoverCat;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setHoverCat(c.id)}
                      className="flex w-full items-center gap-[10px] rounded-(--radius-lg) px-[12px] py-[10px] text-start transition-colors"
                      style={{
                        background: active ? 'rgba(var(--accent-rgb),0.1)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-soft)',
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = `/explore?cat=${c.id}`;
                      }}
                    >
                      <RowIcon className="h-[20px] w-[20px]" />
                      <span className="flex-1 text-[14.5px] font-semibold">{c.ar}</span>
                      <ChevronLeft className="h-[18px] w-[18px] text-muted-2" />
                    </button>
                  );
                })}
              </div>

              {/* subcategories */}
              <div className="px-[30px] py-[26px]">
                <Link
                  href={`/explore?cat=${cat.id}`}
                  className="mb-[20px] flex items-baseline gap-[9px]"
                >
                  {Icon && <Icon className="h-[24px] w-[24px]" style={{ color: 'var(--accent)' }} />}
                  <h3 className="text-[21px] font-bold">{cat.ar}</h3>
                  <span className="text-[12.5px] text-muted-2">{cat.count} مشروع</span>
                  <ChevronLeft className="ms-auto h-[18px] w-[18px]" style={{ color: 'var(--accent)' }} />
                </Link>
                <div className="grid grid-cols-2 gap-x-[28px] gap-y-[4px]">
                  {subs.map((s) => (
                    <Link
                      key={s}
                      href={`/explore?cat=${cat.id}&sub=${encodeURIComponent(s)}`}
                      className="navlink inline-block py-[8px] text-[15px] text-text-soft"
                    >
                      {s}
                    </Link>
                  ))}
                </div>
              </div>

              {/* filters */}
              <div
                className="border-s px-[26px] py-[26px]"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.07)' }}
              >
                <div className="num mb-[16px] text-[12.5px] font-bold tracking-[0.5px] text-muted-2">
                  تصفية حسب
                </div>
                <div className="flex flex-col gap-[2px]">
                  {FILTERS.map((f) => (
                    <Link
                      key={f.id}
                      href={`/explore?status=${f.id}`}
                      className="btng flex items-center gap-[11px] rounded-(--radius-lg) px-[11px] py-[9px] text-text-soft"
                    >
                      <f.icon className="h-[19px] w-[19px]" style={{ color: 'var(--accent)' }} />
                      <span className="text-[14.5px] font-medium">{f.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* featured project */}
              <div
                className="border-s px-[26px] py-[26px]"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.07)', background: 'rgba(var(--ink-rgb),0.02)' }}
              >
                <div className="num mb-[14px] text-[12.5px] font-bold tracking-[0.5px] text-muted-2">
                  مشروع مميّز
                </div>
                <Link
                  href={`/projects/${featured.id}`}
                  className="lift block overflow-hidden rounded-(--radius-card) border bg-card"
                  style={{ borderColor: 'rgba(var(--ink-rgb),0.09)' }}
                >
                  <Ph className="relative h-[118px]" label={featured.categoryAr}>
                    <div
                      className="absolute right-0 bottom-0 left-0 h-[4px]"
                      style={{ background: 'rgba(var(--ink-rgb),0.12)' }}
                    >
                      <ProgressBar pct={featPct / 100} height={4} trackAlpha={0} className="rounded-none" />
                    </div>
                  </Ph>
                  <div className="px-[14px] pt-[13px] pb-[15px]">
                    <div className="mb-[4px] text-[14.5px] font-bold leading-[1.35]">
                      {featured.titleAr}
                    </div>
                    <div className="mb-[10px] text-[12px] text-muted-2">{featured.creator}</div>
                    <div className="flex items-center gap-[6px] text-[12px]">
                      <span className="num font-bold" style={{ color: 'var(--accent)' }}>
                        {toArabicDigits(featPct)}%
                      </span>
                      <span className="text-muted-2">مموَّل · {toArabicDigits(featured.daysLeft)} يوم متبقٍ</span>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
