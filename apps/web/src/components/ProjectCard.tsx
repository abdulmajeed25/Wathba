import Link from 'next/link';
import { Bookmark, BadgeCheck } from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Ph } from './Ph';
import { ProgressBar } from './ProgressBar';
import { Pill } from './Pill';
import type { ProjectCard as Data } from '@/data/mock';
import { cn } from '@/lib/cn';

interface Props {
  project: Data;
  /** Trending grid (4-col) = 158px image. Discover grid = 170px. */
  variant?: 'trending' | 'discover' | 'category';
  className?: string;
}

/**
 * Trending/discover/category card. Matches the design 1:1:
 *   border 1px ink-08, radius 18, surface bg, flex column.
 *   image: `.ph` pattern, height per variant.
 *   top-right: category chip (rgba(6,18,31,0.8) bg, blur, 1px ink-12 border).
 *   top-left:  bookmark icon (30×30, radius 9, muted).
 *   body: padding 15px 16px 17px.
 *     title 16.5/700 LS -0.3 (trending) | 17/700 LS -0.3 (discover).
 *     meta "بواسطة …" 12.5 muted-2.
 *     progress: height 6, alpha 0.08.
 *     pct 15/700 accent (or pos if ≥100); raised 12.5 Space Grotesk muted-2.
 *     backers + days row 11.5 muted-2.
 *   §7 platform-partner: bottom-right pill on the image.
 */
export function ProjectCard({ project: p, variant = 'trending', className }: Props) {
  const pct = Math.round((p.raisedHalalas / p.goalHalalas) * 100);
  const over = pct >= 100;
  const titleSize = variant === 'discover' ? 'text-[17px]' : 'text-[16.5px]';
  const imgHeight = variant === 'discover' ? 'h-[170px]' : 'h-[158px]';
  const formatSAR = (h: number) =>
    `${(h / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} ر.س`;

  return (
    <Link
      href={`/projects/${p.id}`}
      className={cn(
        'lift flex cursor-pointer flex-col overflow-hidden rounded-(--radius-card-lg) border bg-card',
        className,
      )}
      style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}
    >
      <Ph className={imgHeight} label={p.categoryAr}>
        {/* category chip (top-right) */}
        <div
          className="absolute top-[11px] right-[11px] rounded-[20px] border px-[10px] py-[5px] text-[11px] font-semibold text-text-soft backdrop-blur-[5px]"
          style={{ background: 'rgba(6,18,31,0.8)', borderColor: 'rgba(var(--ink-rgb),0.12)', color: '#fff' }}
        >
          {p.categoryAr}
        </div>
        {/* bookmark (top-left) */}
        <div
          className="absolute top-[11px] left-[11px] grid h-[30px] w-[30px] place-items-center rounded-(--radius-sm) border backdrop-blur-[5px]"
          style={{ background: 'rgba(6,18,31,0.8)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
        >
          <Bookmark className="h-[16px] w-[16px]" style={{ color: '#9aa7a0' }} />
        </div>
        {/* §7 platform-partner */}
        {p.platformPartner && (
          <div className="absolute right-[11px] bottom-[11px]">
            <Pill tone="partner" size="sm">
              <BadgeCheck className="h-[12px] w-[12px]" /> بشراكة وثبة
            </Pill>
          </div>
        )}
      </Ph>

      <div className="flex flex-1 flex-col px-[16px] pt-[15px] pb-[17px]">
        <h3 className={cn(titleSize, 'mb-[4px] font-bold tracking-[-0.3px] text-text')}>{p.titleAr}</h3>
        <div className="mb-[13px] text-[12.5px] text-muted-2">بواسطة {p.creator}</div>

        <div className="mt-auto">
          <ProgressBar pct={pct / 100} height={6} trackAlpha={0.08} over={over} className="mb-[10px]" />
          <div className="flex items-center justify-between">
            <span
              className="num text-[15px] font-bold"
              style={{ color: over ? 'var(--pos)' : 'var(--accent)' }}
            >
              {toArabicDigits(pct)}٪
            </span>
            <span className="num text-[12.5px] text-muted">{formatSAR(p.raisedHalalas)}</span>
          </div>
          <div className="mt-[8px] flex items-center justify-between text-[11.5px] text-muted-2">
            <span className="num">{toArabicDigits(p.backersCount.toLocaleString('en-US'))} داعم</span>
            <span className="num">{toArabicDigits(p.daysLeft)} يوم متبقٍ</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
