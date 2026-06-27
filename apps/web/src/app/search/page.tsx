'use client';

import { useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProjectCard } from '@/components/ProjectCard';
import { trendingProjects } from '@/data/mock';

const SUGGESTIONS = ['تقنية', 'سِرب', 'حكايا', 'تصميم', 'أطفال', 'موسيقى'];

export default function SearchPage() {
  const [q, setQ] = useState('');
  const results = q.trim()
    ? trendingProjects.filter((p) => p.titleAr.includes(q) || p.shortDescAr.includes(q) || p.creator.includes(q))
    : trendingProjects;

  return (
    <>
      <Header />
      <main>
        <section className="mx-auto max-w-(--container-card) px-[26px] pt-[48px]">
          <h1 className="mb-[20px] text-[32px] font-bold tracking-[-0.7px]">ابحث في وثبة</h1>
          <div
            className="mb-[18px] flex items-center gap-[12px] rounded-(--radius-card) border-[1.5px] px-[20px] py-[16px]"
            style={{
              background: 'rgba(var(--ink-rgb),0.05)',
              borderColor: q ? 'var(--accent)' : 'rgba(var(--accent-rgb),0.3)',
            }}
          >
            <SearchIcon className="h-[26px] w-[26px]" style={{ color: 'var(--accent)' }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن مشاريع، مبدعين، فئات…"
              className="flex-1 bg-transparent text-[17px]"
            />
            {q && (
              <button onClick={() => setQ('')}>
                <X className="h-[20px] w-[20px] text-muted-2" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-[10px]">
            <span className="text-[13px] text-muted-2">اقتراحات:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="chip rounded-(--radius-pill) border px-[14px] py-[7px] text-[13px] font-semibold text-muted"
                style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.1)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-[30px] max-w-(--container-app) px-[26px] pb-[10px]">
          <div className="mb-[20px] text-[14px] text-muted">
            <span className="num font-bold text-text">{toArabicDigits(results.length)}</span> نتيجة
          </div>
          <div className="grid gap-[18px] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {results.map((p) => <ProjectCard key={p.id} project={p} variant="discover" />)}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
