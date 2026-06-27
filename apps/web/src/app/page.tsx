import Link from 'next/link';
import {
  Cpu, Palette, Film, Music, Utensils, Gamepad2, BookOpen, Shirt,
  Bolt, Compass, TrendingUp, Eye, Award, ArrowLeft, Heart, Lightbulb, Users, Rocket,
} from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Pill } from '@/components/Pill';
import { Card } from '@/components/Card';
import { Ph } from '@/components/Ph';
import { ProgressBar } from '@/components/ProgressBar';
import { ProjectCard } from '@/components/ProjectCard';
import { ButtonLink } from '@/components/Button';
import {
  featuredProject,
  trendingProjects,
  categories,
  budgetSplit,
  liveTicker,
  ranks,
  howSteps,
} from '@/data/mock';

const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  cpu: Cpu, palette: Palette, film: Film, music: Music,
  utensils: Utensils, gamepad2: Gamepad2, 'book-open': BookOpen, shirt: Shirt,
};

const STEP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  lightbulb: Lightbulb, users: Users, rocket: Rocket,
};

const RANK_ICON_MAP: Record<string, string> = {
  user: 'user', 'thumbs-up': 'thumbs-up', 'badge-check': 'badge-check', award: 'award', crown: 'crown',
};

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        {/* HERO */}
        <section className="mx-auto grid max-w-(--container-app) items-center gap-[54px] px-[26px] pt-[64px] pb-[30px] md:grid-cols-[1.05fr_0.95fr]">
          <div className="relative">
            <Pill tone="accent" withDot className="mb-[24px]">منصة الدعم الجماعي الأولى عربياً</Pill>
            <h1 className="mb-[22px] text-[42px] leading-[1.05] font-bold tracking-[-1.5px] text-text md:text-[62px]">
              حوّل فكرتك
              <br />
              إلى <span className="gradtext">واقعٍ ملموس</span>
            </h1>
            <p className="mb-[32px] max-w-[480px] text-[18.5px] leading-[1.7] text-text-soft">
              وثبة تجمع المبدعين بمجتمعٍ يؤمن بهم. اعرض مشروعك، اجمع التمويل بشفافية كاملة، وكافئ
              داعميك برتبٍ ومزايا فريدة.
            </p>
            <div className="mb-[42px] flex flex-wrap gap-[14px]">
              <ButtonLink href="/launch" size="lg">
                <Bolt className="h-[21px] w-[21px]" /> أطلق مشروعك
              </ButtonLink>
              <ButtonLink href="/explore" size="lg" variant="outline">
                <Compass className="h-[21px] w-[21px]" /> استكشف المشاريع
              </ButtonLink>
            </div>
            <div className="flex gap-[36px]">
              <Stat value="٢١.٤M ر.س" label="أموال جُمعت" />
              <Divider />
              <Stat value="١٢٤K" label="داعم نشط" />
              <Divider />
              <Stat value="٤٨٢" label="مشروع مموَّل" />
            </div>
          </div>

          {/* featured project */}
          <div className="relative">
            <div
              className="absolute inset-[-24px] z-0 blur-[8px]"
              style={{
                background:
                  'radial-gradient(circle at 60% 30%, rgba(var(--accent-rgb),0.22), transparent 65%)',
              }}
            />
            <Link href={`/projects/${featuredProject.id}`} className="relative z-[1] block">
              <Card radius="cardFeatured" lift surface className="overflow-hidden" >
                <Ph className="relative h-[248px]" label="صورة المشروع">
                  <div
                    className="absolute top-[16px] right-[16px] flex items-center gap-[7px] rounded-[30px] border px-[13px] py-[7px] text-[12.5px] font-bold backdrop-blur-[6px]"
                    style={{
                      background: 'rgba(6,18,31,0.85)',
                      borderColor: 'rgba(var(--accent-rgb),0.4)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Heart className="h-[14px] w-[14px]" fill="currentColor" /> مشروع نحبه
                  </div>
                  <div
                    className="absolute right-0 bottom-0 left-0 h-[90px]"
                    style={{ background: 'linear-gradient(0deg,var(--surface2),transparent)' }}
                  />
                </Ph>
                <div className="px-[24px] pt-[22px] pb-[26px]">
                  <div className="mb-[10px] flex items-center gap-[8px] text-[12.5px] text-muted-2">
                    <span className="font-semibold" style={{ color: 'var(--accent)' }}>تقنية</span>
                    <span>·</span>
                    <span>{featuredProject.cityAr}</span>
                  </div>
                  <h3 className="mb-[6px] text-[23px] font-bold tracking-[-0.4px] text-text">
                    {featuredProject.titleAr}
                  </h3>
                  <p className="mb-[20px] text-[14px] leading-[1.6] text-muted">
                    {featuredProject.shortDescAr}
                  </p>
                  <ProgressBar pct={1} over height={9} trackAlpha={0.08} className="mb-[14px]" />
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="num text-[22px] font-bold text-text">
                        {(featuredProject.raisedHalalas / 100).toLocaleString('en-US')} ر.س
                      </span>
                      <span className="num me-[6px] ms-[6px] text-[13px] text-muted-2">
                        من {(featuredProject.goalHalalas / 100).toLocaleString('en-US')} ر.س
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="num text-[20px] font-bold" style={{ color: 'var(--accent)' }}>
                        {toArabicDigits(
                          Math.round(
                            (featuredProject.raisedHalalas / featuredProject.goalHalalas) * 100,
                          ),
                        )}%
                      </div>
                      <div className="text-[11px] text-muted-2">مُموَّل</div>
                    </div>
                    <div className="text-center">
                      <div className="num text-[20px] font-bold text-text">
                        {toArabicDigits(featuredProject.daysLeft)}
                      </div>
                      <div className="text-[11px] text-muted-2">يوم متبقٍ</div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </section>

        {/* live ticker */}
        <section className="mx-auto mt-[14px] max-w-(--container-app) px-[26px]">
          <div
            className="flex items-center overflow-hidden rounded-(--radius-btn) border"
            style={{
              borderColor: 'rgba(var(--ink-rgb),0.07)',
              background: 'rgba(var(--ink-rgb),0.02)',
            }}
          >
            <div
              className="flex flex-shrink-0 items-center gap-[8px] border-e px-[18px] py-[12px] text-[13px] font-bold"
              style={{
                background: 'rgba(52,211,153,0.1)',
                borderColor: 'rgba(var(--ink-rgb),0.07)',
                color: 'var(--pos)',
              }}
            >
              <span className="h-[8px] w-[8px] rounded-full" style={{ background: 'var(--pos)' }} />
              مباشر الآن
            </div>
            <div
              className="flex-1 overflow-hidden"
              style={{ WebkitMask: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)' }}
            >
              <div
                className="inline-flex gap-[40px] py-[12px] text-[13.5px] whitespace-nowrap text-muted"
                style={{ animation: 'wathba-ticker 26s linear infinite' }}
              >
                {[...liveTicker, ...liveTicker].map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* categories strip */}
        <section className="mx-auto mt-[56px] max-w-(--container-app) px-[26px]">
          <div className="mb-[20px] flex items-center justify-between">
            <h2 className="text-[24px] font-bold tracking-[-0.4px]">تصفّح حسب الفئة</h2>
            <Link href="/explore" className="navlink flex items-center gap-[5px] text-[14px] text-muted">
              عرض الكل
              <ArrowLeft className="h-[18px] w-[18px]" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-4 md:grid-cols-8">
            {categories.map((c) => {
              const Icon = CAT_ICON[c.icon]!;
              return (
                <Link
                  key={c.id}
                  href={`/explore?cat=${c.id}`}
                  className="lift block rounded-(--radius-card-lg) border bg-card px-[12px] py-[20px] text-center"
                  style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}
                >
                  <div
                    className="mx-auto mb-[12px] grid h-[48px] w-[48px] place-items-center rounded-(--radius-btn)"
                    style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}
                  >
                    <Icon className="h-[25px] w-[25px]" />
                  </div>
                  <div className="text-[14px] font-semibold">{c.ar}</div>
                  <div className="num mt-[3px] text-[11.5px] text-muted-2">{c.count}</div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* trending */}
        <section className="mx-auto mt-[64px] max-w-(--container-app) px-[26px]">
          <div className="mb-[22px] flex flex-wrap items-center justify-between gap-[14px]">
            <div>
              <h2 className="flex items-center gap-[10px] text-[28px] font-bold tracking-[-0.5px]">
                <TrendingUp className="h-[28px] w-[28px]" style={{ color: 'var(--accent)' }} />
                المشاريع الرائجة
              </h2>
              <p className="mt-[6px] text-[14px] text-muted-2">
                أكثر المشاريع جذباً للداعمين هذا الأسبوع
              </p>
            </div>
          </div>
          <div className="grid gap-[18px] sm:grid-cols-2 md:grid-cols-4">
            {trendingProjects.slice(0, 8).map((p) => (
              <ProjectCard key={p.id} project={p} variant="trending" />
            ))}
          </div>
        </section>

        {/* transparency band */}
        <section className="mx-auto mt-[74px] max-w-(--container-app) px-[26px]">
          <div
            className="relative grid items-center gap-[46px] overflow-hidden rounded-(--radius-card-band) border p-[44px] md:grid-cols-2"
            style={{ borderColor: 'rgba(var(--ink-rgb),0.08)', background: 'var(--band)' }}
          >
            <div
              className="absolute top-[-60px] left-[-60px] h-[240px] w-[240px] rounded-full"
              style={{ background: 'radial-gradient(circle,rgba(var(--accent-rgb),0.18),transparent 70%)' }}
            />
            <div className="relative">
              <Pill tone="pos" className="mb-[18px]">
                <Eye className="h-[14px] w-[14px]" /> شفافية مطلقة
              </Pill>
              <h2 className="mb-[14px] text-[32px] leading-[1.2] font-bold tracking-[-0.6px]">
                تابع كل ريال
                <br />
                إلى أين يذهب
              </h2>
              <p className="mb-[24px] text-[15.5px] leading-[1.7] text-text-soft">
                لكل مشروع لوحة ميزانية حيّة تُظهر كيف تُنفَق أموالك، مع تحديثات مالية دورية موثّقة. لا
                مفاجآت — فقط ثقة.
              </p>
              <ButtonLink href="/projects/sirb" variant="outline">شاهد لوحة الشفافية</ButtonLink>
            </div>
            <div
              className="relative rounded-(--radius-card-lg) border p-[24px]"
              style={{ background: 'var(--surface2)', borderColor: 'rgba(var(--ink-rgb),0.08)' }}
            >
              <div className="mb-[18px] flex justify-between text-[13px] text-muted-2">
                <span>توزيع الميزانية — سِرب</span>
                <span className="num" style={{ color: 'var(--accent)' }}>
                  {(featuredProject.raisedHalalas / 100).toLocaleString('en-US')} ر.س
                </span>
              </div>
              {budgetSplit.map((b) => (
                <div key={b.label} className="mb-[16px]">
                  <div className="mb-[7px] flex justify-between text-[13px]">
                    <span className="text-text-soft">{b.label}</span>
                    <span className="num text-muted">{toArabicDigits(b.pct)}%</span>
                  </div>
                  <div
                    className="overflow-hidden rounded-(--radius-pill)"
                    style={{ height: 8, background: 'rgba(var(--ink-rgb),0.06)' }}
                  >
                    <div
                      className="h-full rounded-(--radius-pill)"
                      style={{ width: `${b.pct}%`, background: b.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ranks teaser */}
        <section className="mx-auto mt-[74px] max-w-(--container-app) px-[26px] text-center">
          <Pill tone="gold" className="mb-[16px]">
            <Award className="h-[16px] w-[16px]" fill="currentColor" /> نظام رتب الداعمين
          </Pill>
          <h2 className="mb-[12px] text-[32px] font-bold tracking-[-0.6px]">كل دعمٍ يرفع مكانتك</h2>
          <p className="mx-auto mb-[38px] max-w-[560px] text-[16px] text-text-soft">
            ادعم أكثر، افتح رتباً أعلى ومزايا حصرية: شارات، وصول مبكر، ولقاءات مع المبدعين.
          </p>
          <div className="grid gap-[16px] sm:grid-cols-2 md:grid-cols-5">
            {ranks.map((r) => (
              <div
                key={r.id}
                className="lift rounded-(--radius-card-lg) border bg-card px-[16px] py-[26px]"
                style={{ borderColor: r.color + '33' }}
              >
                <div
                  className="mx-auto mb-[14px] grid h-[56px] w-[56px] place-items-center rounded-full"
                  style={{ background: r.bg, color: r.color }}
                >
                  <span className="text-[28px]">★</span>
                </div>
                <div className="mb-[4px] text-[16px] font-bold" style={{ color: r.color }}>{r.ar}</div>
                <div className="num mb-[8px] text-[11.5px] tracking-[1px] text-muted-2">{r.en}</div>
                <div className="num text-[12.5px] text-muted">{r.req}</div>
              </div>
            ))}
          </div>
          <div className="mt-[34px]">
            <ButtonLink href="/ranks" variant="outline" size="md">اكتشف كل المزايا</ButtonLink>
          </div>
          {/* silence unused import lint */}
          <span className="hidden">{RANK_ICON_MAP.user}</span>
        </section>

        {/* how it works teaser */}
        <section className="mx-auto mt-[74px] max-w-(--container-app) px-[26px]">
          <h2 className="mb-[8px] text-center text-[28px] font-bold tracking-[-0.5px]">
            كيف تعمل وثبة
          </h2>
          <p className="mb-[40px] text-center text-[15px] text-muted-2">
            ثلاث خطوات تفصلك عن تحقيق فكرتك
          </p>
          <div className="grid gap-[22px] md:grid-cols-3">
            {howSteps.map((s) => {
              const Icon = STEP_ICON[s.icon]!;
              return (
                <div
                  key={s.n}
                  className="lift relative overflow-hidden rounded-(--radius-card-xl) border bg-card p-[30px]"
                  style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}
                >
                  <div
                    className="num absolute top-[-14px] left-[18px] text-[88px] font-bold"
                    style={{ color: 'rgba(var(--accent-rgb),0.06)' }}
                  >
                    {s.n}
                  </div>
                  <div
                    className="relative mb-[18px] grid h-[54px] w-[54px] place-items-center rounded-(--radius-card)"
                    style={{
                      background:
                        'linear-gradient(135deg,rgba(var(--accent2-rgb),0.2),rgba(var(--accent-rgb),0.2))',
                      color: 'var(--accent)',
                    }}
                  >
                    <Icon className="h-[27px] w-[27px]" />
                  </div>
                  <h3 className="relative mb-[9px] text-[19px] font-bold">{s.titleAr}</h3>
                  <p className="relative text-[14px] leading-[1.65] text-muted">{s.descAr}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA band */}
        <section className="mx-auto mt-[74px] max-w-(--container-app) px-[26px]">
          <div
            className="relative overflow-hidden rounded-(--radius-card-cta) px-[44px] py-[56px] text-center"
            style={{
              background: 'var(--cta-grad)',
              backgroundSize: '220% 220%',
              animation: 'wathba-gshift 9s ease infinite',
            }}
          >
            <h2
              className="mb-[14px] text-[38px] font-bold tracking-[-0.8px]"
              style={{ color: 'var(--on-accent)' }}
            >
              عندك فكرة؟ لنطلقها معاً.
            </h2>
            <p
              className="mx-auto mb-[30px] max-w-[520px] text-[17px]"
              style={{ color: 'rgba(6,18,31,0.78)' }}
            >
              انضم لآلاف المبدعين الذين حوّلوا أفكارهم إلى مشاريع ناجحة على وثبة.
            </p>
            <div className="flex flex-wrap justify-center gap-[14px]">
              <Link
                href="/launch"
                className="btnp rounded-(--radius-btn) px-[30px] py-[15px] text-[16px] font-bold text-text"
                style={{ background: 'var(--on-accent)' }}
              >
                ابدأ مشروعك الآن
              </Link>
              <Link
                href="/how"
                className="rounded-(--radius-btn) border px-[30px] py-[15px] text-[16px] font-bold"
                style={{ borderColor: 'rgba(6,18,31,0.4)', color: 'var(--on-accent)' }}
              >
                تعلّم المزيد
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="num text-[30px] font-bold text-text">{value}</div>
      <div className="mt-[2px] text-[13px] text-muted-2">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="w-px" style={{ background: 'rgba(var(--ink-rgb),0.1)' }} />;
}
