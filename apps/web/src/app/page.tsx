/**
 * Phase 0 smoke index — proves Next 15 + Tailwind v4 + RTL + IBM Plex
 * Sans Arabic + Space Grotesk + design tokens wire correctly.
 * Phase 1 replaces this with the full Home screen from WATHBAوثبة.dc.html.
 */
import { Rocket } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function HomeSmoke() {
  return (
    <main className="mx-auto min-h-dvh max-w-(--container-app) px-6 py-12 md:px-7">
      <header className="flex items-center justify-between pb-8">
        <div className="flex items-center gap-3">
          <div
            className="grid h-[42px] w-[42px] place-items-center rounded-(--radius-brand) text-on-accent"
            style={{ background: 'var(--grad)', boxShadow: 'var(--shadow-logo)' }}
          >
            <Rocket strokeWidth={2.5} className="h-[22px] w-[22px]" />
          </div>
          <div>
            <div className="text-[19px] font-bold tracking-[-0.3px] text-text">وثبة</div>
            <div className="num text-[9.5px] tracking-[3px] text-muted-2">LEAP FORWARD</div>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <section className="space-y-6 pt-8">
        <p className="inline-flex items-center gap-2 rounded-(--radius-pill) border border-[rgba(var(--accent-rgb),0.28)] bg-[rgba(var(--accent-rgb),0.10)] px-[14px] py-[7px] text-[13px] font-semibold text-accent">
          <span className="h-[7px] w-[7px] rounded-full bg-accent" />
          منصة الدعم الجماعي الأولى عربياً
        </p>

        <h1 className="text-[42px] leading-[1.05] font-bold tracking-[-1.5px] text-text md:text-[62px]">
          حوّل فكرتك
          <br />
          إلى <span className="gradtext">واقعٍ ملموس</span>
        </h1>

        <p className="max-w-[480px] text-[16px] leading-[1.7] text-text-soft md:text-[18.5px]">
          وثبة تجمع المبدعين بمجتمعٍ يؤمن بهم. اعرض مشروعك، اجمع التمويل بشفافية كاملة، وكافئ
          داعميك برتبٍ ومزايا فريدة.
        </p>

        <div className="flex flex-wrap gap-3">
          <a
            href="#"
            className="btnp inline-flex items-center gap-2 rounded-(--radius-btn) px-7 py-[15px] text-[16px] font-bold text-on-accent"
            style={{ background: 'var(--grad)' }}
          >
            أطلق مشروعك
          </a>
          <a
            href="#"
            className="btng inline-flex items-center gap-2 rounded-(--radius-btn) border border-[rgba(var(--ink-rgb),0.16)] px-7 py-[15px] text-[16px] font-semibold text-text"
          >
            استكشف المشاريع
          </a>
        </div>

        <div className="rounded-(--radius-card-lg) border border-[rgba(var(--ink-rgb),0.08)] bg-surface p-6">
          <p className="text-[14px] text-muted">
            Phase 0 smoke — Next.js 15 + Tailwind v4 + RTL + IBM Plex Sans Arabic + Space Grotesk
            (numbers: <span className="num font-bold text-accent">1,247,500 ر.س</span>) + theme
            toggle wired. Theme persists across reload.
          </p>
        </div>
      </section>
    </main>
  );
}
