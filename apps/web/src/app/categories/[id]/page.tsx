import Link from 'next/link';
import { ArrowRight, Cpu, Palette, Film, Music, Utensils, Gamepad2, BookOpen, Shirt, Compass } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProjectCard } from '@/components/ProjectCard';
import { categories, trendingProjects } from '@/data/mock';

const CAT_ICON = {
  cpu: Cpu, palette: Palette, film: Film, music: Music,
  utensils: Utensils, gamepad2: Gamepad2, 'book-open': BookOpen, shirt: Shirt,
} as const;

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = categories.find((c) => c.id === id) ?? categories[0]!;
  const Icon = CAT_ICON[cat.icon as keyof typeof CAT_ICON] ?? Compass;
  const list = trendingProjects.filter((p) => p.category === cat.id);

  return (
    <>
      <Header />
      <main>
        <section
          className="relative overflow-hidden border-b"
          style={{ borderColor: 'rgba(var(--ink-rgb),0.07)' }}
        >
          <div
            className="ph absolute inset-0 opacity-50"
            style={{ background: 'var(--ph-bg)' }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg,rgba(10,20,34,0.6),var(--bg))' }}
          />
          <div className="relative mx-auto max-w-(--container-app) px-[26px] pt-[60px] pb-[40px]">
            <Link href="/explore" className="navlink mb-[18px] inline-flex items-center gap-[6px] text-[13px] text-muted">
              <ArrowRight className="h-[17px] w-[17px]" />كل الفئات
            </Link>
            <div className="flex items-center gap-[18px]">
              <div
                className="grid h-[72px] w-[72px] place-items-center rounded-(--radius-card-xl)"
                style={{
                  background: 'linear-gradient(135deg,rgba(var(--accent2-rgb),0.25),rgba(var(--accent-rgb),0.25))',
                  color: 'var(--accent)',
                }}
              >
                <Icon className="h-[38px] w-[38px]" />
              </div>
              <div>
                <h1 className="text-[44px] font-bold tracking-[-1px]">{cat.ar}</h1>
                <p className="num mt-[4px] text-[14px] text-muted">
                  {cat.count} · <span style={{ color: 'var(--accent)' }}>{cat.en}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-(--container-app) px-[26px] pt-[34px]">
          <h2 className="mb-[20px] text-[20px] font-bold">مشاريع في {cat.ar}</h2>
          <div className="grid gap-[18px] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {list.length > 0 ? (
              list.map((p) => <ProjectCard key={p.id} project={p} variant="category" />)
            ) : (
              <p className="text-muted-2">لا توجد مشاريع حالياً في هذه الفئة.</p>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
