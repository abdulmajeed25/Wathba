import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Bell, Share2, ArrowRight, ShieldCheck, BadgeCheck, Lightbulb, BarChart3,
  BookOpen, MessageCircle, HelpCircle, Megaphone, Eye,
} from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { Ph } from '@/components/Ph';
import { ProgressBar } from '@/components/ProgressBar';
import { Pill } from '@/components/Pill';
import { ButtonLink } from '@/components/Button';
import { RewardTiers } from '@/components/RewardTiers';
import { trendingProjects, budgetSplit } from '@/data/mock';

const TX_TIMELINE = [
  { label: 'دفعة المصنّع — الجولة الأولى', date: '٢٠٢٦/٠٥/٠٤', amount: '٤٦٠,٠٠٠ ر.س' },
  { label: 'مكوّنات إلكترونية مستوردة',     date: '٢٠٢٦/٠٥/١٢', amount: '١٨٠,٠٠٠ ر.س' },
  { label: 'حملة تسويقية رقمية',            date: '٢٠٢٦/٠٥/٢٠', amount: '٧٠,٠٠٠ ر.س'  },
  { label: 'استشارة قانونية',               date: '٢٠٢٦/٠٥/٢٥', amount: '٢٢,٠٠٠ ر.س'  },
  { label: 'تطوير برمجي للتطبيق المرافق',    date: '٢٠٢٦/٠٦/٠١', amount: '١١٠,٠٠٠ ر.س' },
];

const UPDATES = [
  { n: 4, tag: 'تصنيع',           date: '٢٠٢٦/٠٦/١٢', title: 'الدفعة الأولى وصلت من المصنع', body: 'تمّ تسليم الدفعة الأولى من ٥٠٠ وحدة. سنبدأ بإرسالها للداعمين في رتبة الإصدار المبكر خلال أسبوعين.' },
  { n: 3, tag: 'تحديث الفريق',     date: '٢٠٢٦/٠٦/٠٤', title: 'انضمام مهندس بصريات جديد',     body: 'سعدنا بانضمام المهندس سعيد إلى فريقنا لتطوير وحدة الكاميرا بدقة 8K.' },
  { n: 2, tag: 'الميزانية',        date: '٢٠٢٦/٠٥/٢٢', title: 'تفاصيل الإنفاق هذا الشهر',     body: 'صرفنا ٧١٠ آلاف ريال هذا الشهر بين تصنيع، مكونات، وتسويق. كل التفاصيل في لوحة الشفافية.' },
];

const COMMENTS = [
  { initial: 'أ', name: 'أحمد القاسم',   rank: 'سفير',    rankColor: 'var(--gold)',   time: 'قبل ساعة',   body: 'أحببت فكرة المنتج، خصوصاً أنه صُنع في المنطقة. هل ستتوفر نسخة بكاميرا حرارية لاحقاً؟',           likes: 12,  reply: 'شكراً أحمد! النسخة الحرارية ضمن خطّتنا للعام القادم — احرص على متابعة التحديثات.' },
  { initial: 'س', name: 'سارة العامري',  rank: 'مناصِر',   rankColor: 'var(--accent)', time: 'قبل ٣ ساعات', body: 'لوحة الشفافية شيء جداً مميز — أتمنى لو كل المنصات تتبنّى هذه الفكرة.',                          likes: 24 },
  { initial: 'ف', name: 'فهد المرّي',    rank: 'داعم',    rankColor: 'var(--blue)',   time: 'أمس',         body: 'متى تتوقعون أن يصل المنتج للسعودية؟ شكراً لكم.',                                                  likes: 5,   reply: 'فهد، الشحن يبدأ من يوليو ٢٠٢٦ بإذن الله.' },
];

const FAQS = [
  { q: 'متى سأستلم مكافأتي؟',                a: 'بعد إغلاق الحملة بـ٢-٤ أشهر — كل رتبة مكافأة تحمل موعد التسليم المتوقع.' },
  { q: 'ماذا يحدث إن لم يصل المشروع لهدفه؟', a: 'يُعاد كامل المبلغ المحجوز إلى بطاقتك تلقائياً، ولن يتمّ خصم أي جزء منه.' },
  { q: 'كيف أعرف كيف صُرفت أموالي؟',          a: 'لوحة الشفافية الحيّة في صفحة المشروع تُحدَّث مع كل مرحلة، وتعرض توزيع الميزانية والإنفاق التفصيلي.' },
  { q: 'هل يمكنني إلغاء دعمي؟',              a: 'نعم، يمكنك إلغاء دعمك أي وقت قبل إغلاق الحملة من «دعومي» في ملفك الشخصي.' },
];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = trendingProjects.find((p) => p.id === id);
  if (!project) notFound();

  const pct = Math.round((project.raisedHalalas / project.goalHalalas) * 100);
  const over = pct >= 100;
  const stretch = project.releaseThresholdPct < 100;
  const thresholdHalalas = Math.round((project.goalHalalas * project.releaseThresholdPct) / 100);

  return (
    <>
      <Header />
      <main>
        {/* Breadcrumb + headline */}
        <section className="mx-auto max-w-(--container-app) px-[26px] pt-[30px]">
          <Link href="/explore" className="navlink mb-[18px] inline-flex items-center gap-[6px] text-[13px] text-muted">
            <ArrowRight className="h-[17px] w-[17px]" />استكشف
          </Link>
          <div className="mb-[8px] flex items-center gap-[10px]">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>{project.categoryAr}</span>
            <span style={{ color: 'var(--ph-label)' }}>·</span>
            <span className="text-[13px] text-muted">{project.cityAr}</span>
          </div>
          <h1 className="mb-[8px] max-w-[820px] text-[40px] font-bold tracking-[-1px]">{project.titleAr}</h1>
          <p className="max-w-[760px] text-[17px] text-text-soft">{project.shortDescAr}</p>
        </section>

        {/* §7 banner (mandatory disclosure when present) */}
        {project.platformPartner && (
          <section className="mx-auto mt-[18px] max-w-(--container-app) px-[26px]">
            <Card radius="card" surface={false} className="flex items-start gap-[12px] p-[18px]"
              {...{ style: { background: 'rgba(109,77,240,0.07)', borderColor: 'rgba(109,77,240,0.3)' } }}>
              <BadgeCheck className="h-[22px] w-[22px] flex-shrink-0" style={{ color: 'var(--purple)' }} />
              <div>
                <div className="mb-[6px] font-bold" style={{ color: 'var(--purple)' }}>
                  بشراكة وثبة · Wathba Venture
                </div>
                <p className="text-[14px] leading-[1.6] text-text-soft">{project.platformPartner.disclosureAr}</p>
              </div>
            </Card>
          </section>
        )}

        {/* gallery + funding sidebar */}
        <section className="mx-auto grid max-w-(--container-app) items-start gap-[30px] px-[26px] pt-[24px] md:grid-cols-[1.55fr_1fr]">
          <div>
            <Ph className="relative h-[430px] rounded-(--radius-card) border" label="فيديو المشروع" {...{ style: { borderColor: 'rgba(var(--ink-rgb),0.08)' } }} />
            <div className="mt-[12px] grid grid-cols-4 gap-[12px]">
              {[0, 1, 2, 3].map((i) => (
                <Ph key={i} className="lift h-[78px] cursor-pointer rounded-(--radius-pad) border" {...{ style: { borderColor: 'rgba(var(--ink-rgb),0.08)' } }} />
              ))}
            </div>
          </div>

          {/* funding sidebar */}
          <Card radius="cardXl" className="p-[26px]">
            <div className="mb-[6px] flex items-baseline gap-[10px]">
              <span className="num text-[36px] font-bold text-text">
                {(project.raisedHalalas / 100).toLocaleString('en-US')} ر.س
              </span>
              <span className="num text-[17px] font-bold" style={{ color: over ? 'var(--pos)' : 'var(--accent)' }}>
                {toArabicDigits(pct)}%
              </span>
            </div>
            <div className="mb-[16px] text-[13px] text-muted-2">
              من هدف {(project.goalHalalas / 100).toLocaleString('en-US')} ر.س
            </div>
            <ProgressBar pct={pct / 100} over={over} height={9} className="mb-[20px]" />

            {/* §5 mandatory threshold disclosure */}
            {stretch && (
              <div
                className="mb-[20px] flex items-start gap-[8px] rounded-(--radius-lg) border p-[12px]"
                style={{ background: 'rgba(var(--accent-rgb),0.07)', borderColor: 'rgba(var(--accent-rgb),0.18)' }}
              >
                <Lightbulb className="h-[18px] w-[18px] flex-shrink-0" style={{ color: 'var(--accent)' }} />
                <div className="text-[12.5px] leading-[1.55] text-text-soft">
                  يكفي الوصول لـ{' '}
                  <span className="num font-bold">{(thresholdHalalas / 100).toLocaleString('en-US')} ر.س</span>{' '}
                  ({toArabicDigits(project.releaseThresholdPct)}%) لإطلاق الإنتاج. المبلغ الأكبر هدف
                  امتداد (Stretch Goal) لميزات إضافية.
                </div>
              </div>
            )}

            <div className="mb-[22px] flex">
              <div className="flex-1">
                <div className="num text-[24px] font-bold text-text">{toArabicDigits(project.backersCount.toLocaleString('en-US'))}</div>
                <div className="text-[12px] text-muted-2">داعم</div>
              </div>
              <div className="w-px" style={{ background: 'rgba(var(--ink-rgb),0.1)' }} />
              <div className="flex-1 ps-[18px]">
                <div className="num text-[24px] font-bold text-text">{toArabicDigits(project.daysLeft)}</div>
                <div className="text-[12px] text-muted-2">يوم متبقٍ</div>
              </div>
            </div>

            <Link
              href={`/pledge/${project.id}`}
              className="btnp mb-[11px] block rounded-(--radius-btn) py-[15px] text-center text-[16px] font-bold text-on-accent"
              style={{ background: 'var(--grad)' }}
            >
              ادعم هذا المشروع
            </Link>

            <div className="flex gap-[11px]">
              <button
                className="btng flex flex-1 items-center justify-center gap-[6px] rounded-(--radius-pad) border py-[11px] text-[13.5px] font-semibold"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.16)' }}
              >
                <Bell className="h-[18px] w-[18px]" />
                ذكّرني
              </button>
              <button
                className="btng flex flex-1 items-center justify-center gap-[6px] rounded-(--radius-pad) border py-[11px] text-[13.5px] font-semibold"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.16)' }}
              >
                <Share2 className="h-[18px] w-[18px]" />
                شارك
              </button>
            </div>

            <div
              className="mt-[20px] flex items-center gap-[10px] border-t pt-[18px]"
              style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}
            >
              <div
                className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-(--radius-pad) font-bold"
                style={{ background: 'var(--grad)', color: 'var(--on-accent)' }}
              >
                {project.creator.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-bold">{project.creator}</div>
                <div className="num text-[11.5px] text-muted-2">٣ مشاريع · مبدع موثّق ✓</div>
              </div>
              <button
                className="btng rounded-(--radius-md) border px-[12px] py-[7px] text-[12px] text-muted"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.16)' }}
              >
                متابعة
              </button>
            </div>

            <div
              className="mt-[16px] flex items-center gap-[8px] rounded-(--radius-lg) border p-[12px] text-[12px] text-muted-2"
              style={{ background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.18)' }}
            >
              <ShieldCheck className="h-[17px] w-[17px]" style={{ color: 'var(--pos)' }} />
              الكل أو لا شيء — يُموَّل فقط عند بلوغ الهدف.
            </div>
          </Card>
        </section>

        {/* tab bar — server-rendered all sections visible, matches design's tabs */}
        <section className="mx-auto mt-[36px] max-w-(--container-app) border-b px-[26px]" style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}>
          <div className="flex gap-[30px] overflow-x-auto">
            {[
              { id: 'story', icon: BookOpen, label: 'القصة' },
              { id: 'transparency', icon: BarChart3, label: 'الشفافية' },
              { id: 'updates', icon: Megaphone, label: 'التحديثات', badge: UPDATES.length },
              { id: 'community', icon: MessageCircle, label: 'المجتمع', badge: COMMENTS.length * 32 },
              { id: 'faq', icon: HelpCircle, label: 'الأسئلة' },
            ].map((t, i) => (
              <Link
                key={t.id}
                href={`#${t.id}`}
                className="flex items-center gap-[8px] border-b-[2px] py-[14px] text-[15px] font-semibold whitespace-nowrap"
                style={{ borderColor: i === 0 ? 'var(--accent)' : 'transparent', color: i === 0 ? 'var(--accent)' : 'var(--muted)' }}
              >
                <t.icon className="h-[19px] w-[19px]" />
                {t.label}
                {t.badge && (
                  <span className="num rounded-(--radius-pill) px-[7px] py-[2px] text-[11px]" style={{ background: 'rgba(var(--ink-rgb),0.08)' }}>
                    {toArabicDigits(t.badge)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* CONTENT — two-column with reward tiers on the right */}
        <section className="mx-auto mt-[30px] grid max-w-(--container-app) items-start gap-[30px] px-[26px] pb-[10px] md:grid-cols-[1.55fr_1fr]">
          <div>
            {/* STORY */}
            <div id="story">
              <h2 className="mb-[14px] text-[24px] font-bold">عن المشروع</h2>
              <p className="mb-[18px] text-[16px] leading-[1.85] text-text-soft">
                بدأت فكرة المشروع من حاجةٍ بسيطة: أداة يصنعها مبدعون من المنطقة، بمعايير عالمية، وبسعرٍ
                عادل. أمضى الفريق ١٨ شهراً في البحث والتطوير قبل أن يصل إلى هذه النسخة التي بين أيديكم
                اليوم.
              </p>
              <p className="mb-[24px] text-[16px] leading-[1.85] text-text-soft">
                كل تفصيلة صُمّمت بعناية — من الخامات المستدامة إلى تجربة الاستخدام السلسة. ودعمكم اليوم
                هو ما يحوّل هذا النموذج إلى منتجٍ بين يدي آلاف الأشخاص.
              </p>
              <Ph className="mb-[24px] h-[300px] rounded-(--radius-card) border" label="صورة توضيحية للمنتج" {...{ style: { borderColor: 'rgba(var(--ink-rgb),0.08)' } }} />
              <h3 className="mb-[14px] text-[20px] font-bold">لماذا الآن؟</h3>
              <p className="text-[16px] leading-[1.85] text-text-soft">
                لأن المنطقة تزخر بالمواهب التي تستحق منصةً تؤمن بها. ولأن الوقت مثاليٌّ لإطلاق منتجٍ
                يجمع بين الهوية المحلية والطموح العالمي. انضم إلينا في هذه الوثبة.
              </p>
            </div>

            {/* TRANSPARENCY */}
            <div id="transparency" className="mt-[40px]">
              <div className="mb-[8px] flex items-center gap-[10px]">
                <Eye className="h-[24px] w-[24px]" style={{ color: 'var(--pos)' }} />
                <h2 className="text-[24px] font-bold">لوحة الشفافية الحيّة</h2>
              </div>
              <p className="mb-[26px] text-[15px] text-muted">
                نوضّح بالضبط كيف يُنفَق كل ريال تدعمنا به. تُحدَّث هذه اللوحة تلقائياً مع كل مرحلة.
              </p>
              <Card radius="cardLg" className="mb-[22px] p-[24px]">
                <div className="mb-[20px] flex justify-between text-[14px] font-semibold">
                  <span>توزيع الميزانية</span>
                  <span className="num" style={{ color: 'var(--accent)' }}>
                    {(project.raisedHalalas / 100).toLocaleString('en-US')} ر.س مُجمّعة
                  </span>
                </div>
                {budgetSplit.map((b) => (
                  <div key={b.label} className="mb-[18px]">
                    <div className="mb-[8px] flex justify-between text-[13.5px]">
                      <span className="text-text-soft">{b.label}</span>
                      <span className="num text-muted">{toArabicDigits(b.pct)}%</span>
                    </div>
                    <div className="overflow-hidden rounded-(--radius-pill)" style={{ height: 9, background: 'rgba(var(--ink-rgb),0.06)' }}>
                      <div className="h-full rounded-(--radius-pill)" style={{ width: `${b.pct}%`, background: b.color }} />
                    </div>
                  </div>
                ))}
              </Card>
              <h3 className="mb-[18px] text-[18px] font-bold">الجدول الزمني للإنفاق</h3>
              <div className="relative">
                {TX_TIMELINE.map((t, i, arr) => (
                  <div key={i} className="relative flex gap-[16px] pb-[22px]">
                    <div className="flex flex-col items-center">
                      <div
                        className="z-[1] h-[16px] w-[16px] rounded-full border-[3px]"
                        style={{ background: 'var(--surface2)', borderColor: 'var(--accent)' }}
                      />
                      {i < arr.length - 1 && (
                        <div className="w-[2px] flex-1" style={{ background: 'rgba(var(--ink-rgb),0.1)' }} />
                      )}
                    </div>
                    <div
                      className="flex flex-1 items-center justify-between rounded-(--radius-brand) border px-[16px] py-[13px]"
                      style={{ background: 'rgba(var(--ink-rgb),0.03)', borderColor: 'rgba(var(--ink-rgb),0.07)' }}
                    >
                      <div>
                        <div className="text-[14.5px] font-semibold">{t.label}</div>
                        <div className="num mt-[2px] text-[12px] text-muted-2">{t.date}</div>
                      </div>
                      <span className="num text-[16px] font-bold" style={{ color: 'var(--accent)' }}>
                        {t.amount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* UPDATES */}
            <div id="updates" className="mt-[40px]">
              <h2 className="mb-[20px] text-[24px] font-bold">تحديثات المبدع</h2>
              {UPDATES.map((u) => (
                <Card key={u.n} radius="card" className="mb-[16px] p-[22px]">
                  <div className="mb-[12px] flex items-center gap-[10px]">
                    <div
                      className="num grid h-[34px] w-[34px] place-items-center rounded-(--radius-md) text-[14px] font-bold"
                      style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}
                    >
                      #{toArabicDigits(u.n)}
                    </div>
                    <Pill tone="accent" size="sm">{u.tag}</Pill>
                    <span className="num ms-auto text-[12px] text-muted-2">{u.date}</span>
                  </div>
                  <h3 className="mb-[8px] text-[18px] font-bold">{u.title}</h3>
                  <p className="text-[14.5px] leading-[1.7] text-muted">{u.body}</p>
                </Card>
              ))}
            </div>

            {/* COMMUNITY */}
            <div id="community" className="mt-[40px]">
              <div className="mb-[18px] flex items-center justify-between">
                <h2 className="text-[24px] font-bold">المجتمع</h2>
                <span className="num text-[13px] text-muted-2">{toArabicDigits(96)} تعليقاً</span>
              </div>
              {COMMENTS.map((c, i) => (
                <div key={i} className="mb-[22px] flex gap-[13px]">
                  <div
                    className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-(--radius-pad) border font-bold"
                    style={{ background: 'var(--avatar)', borderColor: 'rgba(var(--ink-rgb),0.1)' }}
                  >
                    {c.initial}
                  </div>
                  <div className="flex-1">
                    <div className="mb-[5px] flex items-center gap-[9px]">
                      <span className="text-[14.5px] font-bold">{c.name}</span>
                      <span
                        className="rounded-(--radius-pill) border px-[9px] py-[2px] text-[11px] font-bold"
                        style={{ color: c.rankColor, borderColor: c.rankColor, background: 'rgba(var(--ink-rgb),0.03)' }}
                      >
                        {c.rank}
                      </span>
                      <span className="num text-[11.5px] text-muted-2">{c.time}</span>
                    </div>
                    <p className="mb-[9px] text-[14.5px] leading-[1.65] text-text-soft">{c.body}</p>
                    {c.reply && (
                      <div
                        className="rounded-(--radius-pad) border p-[12px]"
                        style={{ background: 'rgba(var(--accent-rgb),0.05)', borderColor: 'rgba(var(--accent-rgb),0.15)' }}
                      >
                        <div className="mb-[5px] flex items-center gap-[7px]">
                          <BadgeCheck className="h-[15px] w-[15px]" style={{ color: 'var(--accent)' }} />
                          <span className="text-[12.5px] font-bold" style={{ color: 'var(--accent)' }}>المبدع</span>
                        </div>
                        <p className="text-[13.5px] leading-[1.6] text-text-soft">{c.reply}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* FAQ */}
            <div id="faq" className="mt-[40px]">
              <h2 className="mb-[20px] text-[24px] font-bold">الأسئلة الشائعة</h2>
              {FAQS.map((f, i) => (
                <Card key={i} radius="card" className="mb-[13px] px-[22px] py-[20px]">
                  <div className="mb-[9px] flex items-center gap-[10px]">
                    <HelpCircle className="h-[20px] w-[20px]" style={{ color: 'var(--accent)' }} />
                    <h3 className="text-[16px] font-bold">{f.q}</h3>
                  </div>
                  <p className="ps-[30px] text-[14px] leading-[1.7] text-muted">{f.a}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* RIGHT — reward tiers */}
          <RewardTiers projectId={project.id} />
        </section>

        {/* lazy CTA */}
        <section className="mx-auto max-w-(--container-app) px-[26px] pt-[60px]">
          <ButtonLink href={`/pledge/${project.id}`} size="lg">ادعم «{project.titleAr}» الآن</ButtonLink>
        </section>
      </main>
      <Footer />
    </>
  );
}
