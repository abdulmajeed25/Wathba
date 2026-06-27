'use client';

import { useState } from 'react';
import { Award, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProjectCard } from '@/components/ProjectCard';
import { trendingProjects } from '@/data/mock';

const TABS = [
  { id: 'backed',  label: 'مشاريع دعمتها' },
  { id: 'created', label: 'مشاريعي' },
  { id: 'saved',   label: 'محفوظة' },
] as const;

export default function ProfilePage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('backed');
  return (
    <>
      <Header />
      <main>
        {/* hero */}
        <section
          className="relative overflow-hidden border-b"
          style={{ borderColor: 'rgba(var(--ink-rgb),0.07)' }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(800px 300px at 80% 0%,rgba(251,191,36,0.10),transparent 60%),radial-gradient(700px 300px at 10% 0%,rgba(var(--accent-rgb),0.10),transparent 55%)',
            }}
          />
          <div className="relative mx-auto flex max-w-(--container-card) flex-wrap items-center gap-[26px] px-[26px] pt-[48px] pb-[30px]">
            <div className="relative">
              <div
                className="grid h-[108px] w-[108px] place-items-center rounded-(--radius-card-featured) text-[46px] font-bold"
                style={{ background: 'var(--grad)', color: 'var(--on-accent)', boxShadow: '0 16px 40px -12px rgba(var(--accent-rgb),0.6)' }}
              >س</div>
              <div
                className="absolute right-[-8px] bottom-[-8px] grid h-[38px] w-[38px] place-items-center rounded-full border-[3px]"
                style={{ background: 'var(--gold)', borderColor: 'var(--bg)', color: 'var(--on-accent)' }}
              >
                <Award className="h-[20px] w-[20px]" fill="currentColor" />
              </div>
            </div>
            <div className="min-w-[260px] flex-1">
              <div className="mb-[6px] flex flex-wrap items-center gap-[12px]">
                <h1 className="text-[32px] font-bold">سارة العامري</h1>
                <span
                  className="inline-flex items-center gap-[6px] rounded-(--radius-pill) border px-[14px] py-[5px] text-[12.5px] font-bold"
                  style={{ color: 'var(--gold)', background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.4)' }}
                >
                  <Award className="h-[16px] w-[16px]" fill="currentColor" /> سفير
                </span>
              </div>
              <p className="mb-[18px] text-[14px] text-muted">
                داعمة للإبداع العربي · انضمّت يناير ٢٠٢٥ · الرياض، السعودية
              </p>
              <div className="flex flex-wrap gap-[30px]">
                <Stat n="12"        l="مشروعاً دعمته" />
                <Stat n="14,400 ر.س" l="إجمالي الدعم" />
                <Stat n="1"         l="مشروع أطلقته" />
              </div>
            </div>
            {/* rank progress */}
            <div
              className="w-[280px] rounded-(--radius-card) border p-[18px]"
              style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.1)' }}
            >
              <div className="mb-[12px] flex items-center justify-between">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--gold)' }}>سفير</span>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--purple)' }}>شريك مؤسس</span>
              </div>
              <div className="mb-[10px] h-[8px] overflow-hidden rounded-(--radius-pill)" style={{ background: 'rgba(var(--ink-rgb),0.08)' }}>
                <div
                  className="h-full rounded-(--radius-pill)"
                  style={{ width: '64%', background: 'linear-gradient(90deg,var(--gold),var(--purple))' }}
                />
              </div>
              <p className="num text-[12px] text-muted">٢٣,١٠٠ ر.س تفصلك عن رتبة «شريك مؤسس»</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-(--container-card) px-[26px] pt-[26px]">
          <div className="mb-[26px] flex flex-wrap gap-[10px]">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="rounded-(--radius-pad) border px-[18px] py-[10px] text-[14px] font-semibold"
                  style={{
                    background: active ? 'rgba(var(--accent-rgb),0.10)' : 'rgba(var(--ink-rgb),0.04)',
                    borderColor: active ? 'var(--accent)' : 'rgba(var(--ink-rgb),0.1)',
                    color: active ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-[18px] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tab === 'backed' && trendingProjects.slice(0, 4).map((p) => <ProjectCard key={p.id} project={p} variant="discover" />)}
            {tab === 'created' && (
              <>
                <ProjectCard project={trendingProjects[0]!} variant="discover" />
                <Link
                  href="/launch"
                  className="btng flex items-center justify-center gap-[8px] rounded-(--radius-card) border border-dashed p-[24px] text-center text-[15px] font-semibold"
                  style={{ borderColor: 'rgba(var(--accent-rgb),0.3)', color: 'var(--accent)' }}
                >
                  <PlusCircle className="h-[22px] w-[22px]" />
                  أطلق مشروعاً جديداً
                </Link>
              </>
            )}
            {tab === 'saved' && trendingProjects.slice(1, 3).map((p) => <ProjectCard key={p.id} project={p} variant="discover" />)}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <span className="num text-[24px] font-bold">{n}</span>
      <span className="ms-[6px] text-[13px] text-muted-2">{l}</span>
    </div>
  );
}
