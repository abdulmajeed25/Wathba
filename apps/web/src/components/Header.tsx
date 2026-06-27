'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { MegaMenu } from './MegaMenu';

/**
 * Sticky app header. Matches design exactly:
 *   sticky top-0 z-60 backdrop-blur-14 background var(--header-bg)
 *   border-b 1px rgba(ink,0.07)
 *   inner: max-w 1320 padding 14×26 gap 26
 *   nav: 14.5px 500 muted; primary CTA gradient + 14 radius padding 11×19
 */
export function Header() {
  return (
    <header
      className="sticky top-0 z-[60] border-b backdrop-blur-[14px]"
      style={{
        background: 'var(--header-bg)',
        borderColor: 'rgba(var(--ink-rgb),0.07)',
      }}
    >
      <div className="mx-auto flex max-w-(--container-app) items-center gap-[26px] px-[26px] py-[14px]">
        <Logo />

        <nav className="hidden items-center gap-[24px] text-[14.5px] font-medium text-muted md:flex">
          <Link href="/explore" className="navlink cursor-pointer">استكشف</Link>
          <MegaMenu />
          <Link href="/how" className="navlink cursor-pointer">كيف تعمل</Link>
          <Link href="/ranks" className="navlink cursor-pointer">رتب الداعمين</Link>
        </nav>

        <Link
          href="/search"
          className="btng hidden max-w-[380px] flex-1 items-center gap-[10px] rounded-(--radius-brand) border px-[15px] py-[10px] md:flex"
          style={{
            background: 'rgba(var(--ink-rgb),0.05)',
            borderColor: 'rgba(var(--ink-rgb),0.09)',
          }}
        >
          <Search className="h-[20px] w-[20px] text-muted-2" />
          <span className="text-[14px] text-muted-2">ابحث عن مشاريع، مبدعين، فئات…</span>
        </Link>

        <div className="ms-auto flex items-center gap-[12px]">
          <ThemeToggle />
          <Link href="/sign-in" className="navlink hidden cursor-pointer text-[14.5px] font-medium text-muted md:inline">
            تسجيل الدخول
          </Link>
          <Link
            href="/launch"
            className="btnp rounded-(--radius-brand) px-[19px] py-[11px] text-[14px] font-bold text-on-accent"
            style={{ background: 'var(--grad)' }}
          >
            ابدأ مشروعك
          </Link>
        </div>
      </div>
    </header>
  );
}
