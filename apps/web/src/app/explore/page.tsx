'use client';

import { useState } from 'react';
import { Cpu, Palette, Film, Music, Utensils, Gamepad2, BookOpen, Shirt, BadgeCheck } from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProjectCard } from '@/components/ProjectCard';
import { trendingProjects, categories } from '@/data/mock';
import { cn } from '@/lib/cn';

const SORTS = [
  { id: 'trending',     label: 'الأكثر رواجاً' },
  { id: 'new',          label: 'الأحدث' },
  { id: 'ending_soon',  label: 'تنتهي قريباً' },
  { id: 'most_funded',  label: 'الأعلى تمويلاً' },
] as const;

const STATUSES = [
  { id: 'all',         label: 'الكل' },
  { id: 'live',        label: 'مباشر' },
  { id: 'successful',  label: 'ناجحة' },
  { id: 'funded',      label: 'مموَّلة' },
] as const;

const CAT_ICON = { cpu: Cpu, palette: Palette, film: Film, music: Music, utensils: Utensils, gamepad2: Gamepad2, 'book-open': BookOpen, shirt: Shirt } as const;

export default function ExplorePage() {
  const [sort, setSort] = useState<typeof SORTS[number]['id']>('trending');
  const [status, setStatus] = useState<typeof STATUSES[number]['id']>('all');
  const [cat, setCat] = useState<string>('all');
  const [includePartnered, setIncludePartnered] = useState(true);

  let list = [...trendingProjects];
  if (cat !== 'all') list = list.filter((p) => p.category === cat);
  if (!includePartnered) list = list.filter((p) => !p.platformPartner);
  if (sort === 'ending_soon') list.sort((a, b) => a.daysLeft - b.daysLeft);
  else if (sort === 'most_funded') list.sort((a, b) => b.raisedHalalas - a.raisedHalalas);
  else if (sort === 'trending') list.sort((a, b) => b.backersCount - a.backersCount);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-app) px-[26px] pt-[48px]">
        <div className="mb-[26px] flex flex-wrap items-end justify-between gap-[16px]">
          <div>
            <div className="num mb-[8px] text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>DISCOVER</div>
            <h1 className="text-[42px] font-bold tracking-[-1px]">استكشف المشاريع</h1>
            <p className="mt-[8px] text-[15px] text-muted">
              <span className="num font-bold text-text">{toArabicDigits(list.length)}</span>
              {' '}مشروعاً ينتظر دعمك الآن
            </p>
          </div>
          <div
            className="flex flex-wrap gap-[9px] rounded-(--radius-brand) border p-[5px]"
            style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.08)' }}
          >
            {SORTS.map((s) => {
              const active = s.id === sort;
              return (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={cn(
                    'rounded-(--radius-sm) px-[15px] py-[8px] text-[13px] font-semibold',
                    active ? '' : 'text-muted',
                  )}
                  style={active ? { background: 'var(--surface)', color: 'var(--text)' } : undefined}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* category chips */}
        <div className="mb-[18px] flex flex-wrap gap-[11px]">
          <button
            onClick={() => setCat('all')}
            className={cn(
              'chip inline-flex items-center gap-[7px] rounded-(--radius-pill) border px-[16px] py-[9px] text-[13.5px] font-semibold',
              cat === 'all' ? '' : 'text-muted',
            )}
            style={{
              background: cat === 'all' ? 'rgba(var(--accent-rgb),0.12)' : 'rgba(var(--ink-rgb),0.04)',
              borderColor: cat === 'all' ? 'rgba(var(--accent-rgb),0.4)' : 'rgba(var(--ink-rgb),0.1)',
              color: cat === 'all' ? 'var(--accent)' : undefined,
            }}
          >
            كل الفئات
          </button>
          {categories.map((c) => {
            const Icon = CAT_ICON[c.icon as keyof typeof CAT_ICON];
            const active = cat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={cn(
                  'chip inline-flex items-center gap-[7px] rounded-(--radius-pill) border px-[16px] py-[9px] text-[13.5px] font-semibold',
                  active ? '' : 'text-muted',
                )}
                style={{
                  background: active ? 'rgba(var(--accent-rgb),0.12)' : 'rgba(var(--ink-rgb),0.04)',
                  borderColor: active ? 'rgba(var(--accent-rgb),0.4)' : 'rgba(var(--ink-rgb),0.1)',
                  color: active ? 'var(--accent)' : undefined,
                }}
              >
                <Icon className="h-[17px] w-[17px]" />
                {c.ar}
              </button>
            );
          })}
        </div>

        {/* status + §7 partner toggle */}
        <div className="mb-[34px] flex flex-wrap items-center gap-[10px]">
          <span className="me-[4px] text-[12.5px] text-muted-2">الحالة:</span>
          {STATUSES.map((s) => {
            const active = s.id === status;
            return (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className="rounded-(--radius-pill) border px-[14px] py-[7px] text-[12.5px] font-semibold"
                style={{
                  background: active ? 'rgba(var(--accent-rgb),0.10)' : 'rgba(var(--ink-rgb),0.04)',
                  borderColor: active ? 'rgba(var(--accent-rgb),0.3)' : 'rgba(var(--ink-rgb),0.1)',
                  color: active ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {s.label}
              </button>
            );
          })}
          {/* §7 platform-partner filter */}
          <button
            onClick={() => setIncludePartnered((v) => !v)}
            className="ms-auto flex items-center gap-[6px] rounded-(--radius-pill) border px-[14px] py-[7px] text-[12.5px] font-semibold"
            style={{
              background: includePartnered ? 'rgba(109,77,240,0.10)' : 'rgba(var(--ink-rgb),0.04)',
              borderColor: includePartnered ? 'rgba(109,77,240,0.4)' : 'rgba(var(--ink-rgb),0.1)',
              color: includePartnered ? 'var(--purple)' : 'var(--muted)',
            }}
          >
            <BadgeCheck className="h-[14px] w-[14px]" /> مشاريع بشراكة وثبة
          </button>
        </div>

        <div className="grid gap-[18px] pb-[20px] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => <ProjectCard key={p.id} project={p} variant="discover" />)}
        </div>
      </main>
      <Footer />
    </>
  );
}
