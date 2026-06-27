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
  /**
   * Variant — each has its own exact image height + title size + padding,
   * directly from the design source.
   *   trending (home, 4-col):     158h | title 16.5 | pad 15/16/17 | no desc
   *   discover (explore, 4-col):  170h | title 17   | pad 16/17/18 | desc 13/1.55
   *   category (cat page, 4-col): 170h | title 17   | pad 16/17/18 | no desc
   *   search   (search results):  160h | title 16   | pad 15/16/17 | pct 14, raised 12
   *   profile  (profile backed):  140h | title 15.5 | pad 15/16/17 | no desc, no badges
   *   saved    (profile saved):   same as profile + gold-filled bookmark overlay
   */
  variant?: 'trending' | 'discover' | 'category' | 'search' | 'profile' | 'saved';
  className?: string;
}

export function ProjectCard({ project: p, variant = 'trending', className }: Props) {
  const pct = Math.round((p.raisedHalalas / p.goalHalalas) * 100);
  const over = pct >= 100;
  const formatSAR = (h: number) =>
    `${(h / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} ر.س`;

  const spec = (() => {
    switch (variant) {
      case 'discover':
        return { imgH: 'h-[170px]', title: 'text-[17px]', pad: 'px-[17px] pt-[16px] pb-[18px]', pctSize: 'text-[15px]', raisedSize: 'text-[12.5px]', progressMb: 'mb-[10px]', showDesc: true, showBadges: true, showBookmark: false };
      case 'category':
        return { imgH: 'h-[170px]', title: 'text-[17px]', pad: 'px-[17px] pt-[16px] pb-[18px]', pctSize: 'text-[15px]', raisedSize: 'text-[12.5px]', progressMb: 'mb-[10px]', showDesc: false, showBadges: false, showBookmark: false };
      case 'search':
        return { imgH: 'h-[160px]', title: 'text-[16px]', pad: 'px-[16px] pt-[15px] pb-[17px]', pctSize: 'text-[14px]', raisedSize: 'text-[12px]', progressMb: 'mb-[9px]', showDesc: false, showBadges: true, showBookmark: false };
      case 'profile':
        return { imgH: 'h-[140px]', title: 'text-[15.5px]', pad: 'px-[16px] pt-[15px] pb-[17px]', pctSize: 'text-[13px]', raisedSize: 'text-[12px]', progressMb: 'mb-[8px]', showDesc: false, showBadges: false, showBookmark: false };
      case 'saved':
        return { imgH: 'h-[140px]', title: 'text-[15.5px]', pad: 'px-[16px] pt-[15px] pb-[17px]', pctSize: 'text-[13px]', raisedSize: 'text-[12px]', progressMb: 'mb-[8px]', showDesc: false, showBadges: false, showBookmark: false, savedBookmark: true };
      case 'trending':
      default:
        return { imgH: 'h-[158px]', title: 'text-[16.5px]', pad: 'px-[16px] pt-[15px] pb-[17px]', pctSize: 'text-[15px]', raisedSize: 'text-[12.5px]', progressMb: 'mb-[10px]', showDesc: false, showBadges: true, showBookmark: true };
    }
  })();

  return (
    <Link
      href={`/projects/${p.id}`}
      className={cn(
        'lift flex cursor-pointer flex-col overflow-hidden rounded-(--radius-card-lg) border bg-card',
        className,
      )}
      style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}
    >
      <Ph className={spec.imgH} label={p.categoryAr}>
        {spec.showBadges && (
          <div
            className="absolute top-[11px] right-[11px] rounded-[20px] border px-[10px] py-[5px] text-[11px] font-semibold backdrop-blur-[5px]"
            style={{ background: 'rgba(6,18,31,0.8)', borderColor: 'rgba(var(--ink-rgb),0.12)', color: '#fff' }}
          >
            {p.categoryAr}
          </div>
        )}
        {spec.showBookmark && (
          <div
            className="absolute top-[11px] left-[11px] grid h-[30px] w-[30px] place-items-center rounded-(--radius-sm) border backdrop-blur-[5px]"
            style={{ background: 'rgba(6,18,31,0.8)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
          >
            <Bookmark className="h-[16px] w-[16px]" style={{ color: '#9aa7a0' }} />
          </div>
        )}
        {'savedBookmark' in spec && spec.savedBookmark && (
          <div
            className="absolute top-[11px] left-[11px] grid h-[30px] w-[30px] place-items-center rounded-(--radius-sm)"
            style={{ background: 'rgba(6,18,31,0.8)' }}
          >
            <Bookmark className="h-[17px] w-[17px]" fill="currentColor" style={{ color: 'var(--gold)' }} />
          </div>
        )}
        {p.platformPartner && spec.showBadges && (
          <div className="absolute right-[11px] bottom-[11px]">
            <Pill tone="partner" size="sm">
              <BadgeCheck className="h-[12px] w-[12px]" /> بشراكة وثبة
            </Pill>
          </div>
        )}
      </Ph>

      <div className={cn('flex flex-1 flex-col', spec.pad)}>
        <h3 className={cn(spec.title, 'mb-[4px] font-bold tracking-[-0.3px] text-text')}>{p.titleAr}</h3>
        <div className={cn('text-[12.5px] text-muted-2', spec.showDesc ? 'mb-[8px]' : 'mb-[13px]')}>بواسطة {p.creator}</div>

        {spec.showDesc && (
          <p className="mb-[14px] text-[13px] leading-[1.55] text-muted">{p.shortDescAr}</p>
        )}

        <div className="mt-auto">
          <ProgressBar pct={pct / 100} height={6} trackAlpha={0.08} over={over} className={spec.progressMb} />
          <div className="flex items-center justify-between">
            <span
              className={cn('num font-bold', spec.pctSize)}
              style={{ color: over ? 'var(--pos)' : 'var(--accent)' }}
            >
              {toArabicDigits(pct)}٪
            </span>
            <span className={cn('num text-muted', spec.raisedSize)}>{formatSAR(p.raisedHalalas)}</span>
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
