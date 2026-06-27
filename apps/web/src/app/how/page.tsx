import { Rocket, Heart, Search, Gift, Eye, HelpCircle, Lightbulb, Users } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';

const STEPS = [
  { n: '01', icon: Lightbulb, t: 'اعرض فكرتك',  d: 'حدّد هدفك، صمّم رتب المكافآت، وأضف وسائل تروّج فكرتك.' },
  { n: '02', icon: Users,     t: 'اجمع المجتمع', d: 'ادعم المشاريع التي تؤمن بها، وشارك مشروعك مع داعميك المحتملين.' },
  { n: '03', icon: Rocket,    t: 'حقّق المشروع', d: 'استلم تمويلك على دفعات حسب الإنجاز، وحافظ على شفافية كاملة.' },
];

const FAQS = [
  { q: 'متى أستلم تمويلي إن نجح مشروعي؟', a: 'تستلمه على دفعات مرتبطة بمراحل المشروع — كل مرحلة تُصرف عند تسليم الأدلة وموافقة الإدارة.' },
  { q: 'كيف تحمي وثبة الداعمين؟',           a: 'كل المبالغ تُحفظ في حساب ضمان مع مزوّد الدفع. لا يستلم المبدع مبالغ إلا بعد تحقّق المراحل.' },
  { q: 'هل أنا ملزم بإرجاع المبلغ؟',         a: 'في حال الفشل، يُسترد المبلغ تلقائياً للداعمين. عند النجاح، أنت ملزم بالتسليم وفق المواصفات المنشورة.' },
  { q: 'ما هي رسوم المنصة؟',                a: '٥٪ فقط عند نجاح الحملة — لا رسوم على الفشل، ولا رسوم لإطلاق المشروع.' },
];

export default function HowPage() {
  return (
    <>
      <Header />
      <main>
        <section className="mx-auto max-w-(--container-narrow) px-[26px] pt-[58px] text-center">
          <div className="num mb-[12px] text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
            HOW IT WORKS
          </div>
          <h1 className="mb-[16px] text-[48px] font-bold tracking-[-1.3px]">
            كيف تعمل <span className="gradtext">وثبة</span>
          </h1>
          <p className="mx-auto max-w-[580px] text-[18px] text-text-soft">
            منصة بسيطة وشفافة تربط المبدعين بالداعمين. سواء كنت تطلق فكرة أو تدعم واحدة — العملية
            واضحة من البداية للنهاية.
          </p>
        </section>

        {/* creators */}
        <section className="mx-auto mt-[50px] max-w-(--container-creators) px-[26px]">
          <div className="mb-[24px] flex items-center gap-[12px]">
            <div
              className="grid h-[40px] w-[40px] place-items-center rounded-(--radius-pad)"
              style={{ background: 'var(--grad)', color: 'var(--on-accent)' }}
            >
              <Rocket fill="currentColor" className="h-[22px] w-[22px]" />
            </div>
            <h2 className="text-[26px] font-bold">للمبدعين</h2>
          </div>
          <div className="mb-[50px] grid gap-[18px] md:grid-cols-3">
            {STEPS.map((s) => (
              <Card key={s.n} radius="cardXl" className="relative overflow-hidden p-[28px]">
                <div
                  className="num absolute top-[-14px] left-[18px] text-[84px] font-bold"
                  style={{ color: 'rgba(var(--accent-rgb),0.06)' }}
                >
                  {s.n}
                </div>
                <div
                  className="relative mb-[18px] grid h-[52px] w-[52px] place-items-center rounded-(--radius-card)"
                  style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}
                >
                  <s.icon className="h-[26px] w-[26px]" />
                </div>
                <h3 className="relative mb-[9px] text-[18px] font-bold">{s.t}</h3>
                <p className="relative text-[14px] leading-[1.65] text-muted">{s.d}</p>
              </Card>
            ))}
          </div>

          {/* backers */}
          <div className="mb-[24px] flex items-center gap-[12px]">
            <div
              className="grid h-[40px] w-[40px] place-items-center rounded-(--radius-pad)"
              style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--gold)' }}
            >
              <Heart className="h-[22px] w-[22px]" fill="currentColor" />
            </div>
            <h2 className="text-[26px] font-bold">للداعمين</h2>
          </div>
          <div className="grid gap-[18px] md:grid-cols-3">
            <BackerStep icon={Search} title="اكتشف" desc="تصفّح آلاف المشاريع عبر الفئات، واعثر على ما يلامس شغفك." />
            <BackerStep icon={Gift}   title="ادعم"  desc="اختر مستوى الدعم المناسب، واحصل على مكافآت حصرية ورتبة ترتقي بدعمك." />
            <BackerStep icon={Eye}    title="تابع بشفافية" desc="راقب تقدّم المشروع ولوحة الميزانية الحيّة حتى وصول مكافأتك إليك." />
          </div>
        </section>

        {/* fees */}
        <section className="mx-auto mt-[60px] max-w-(--container-creators) px-[26px]">
          <div
            className="grid grid-cols-1 gap-[30px] rounded-(--radius-card-featured) border p-[40px] text-center md:grid-cols-3"
            style={{ background: 'var(--band)', borderColor: 'rgba(var(--ink-rgb),0.08)' }}
          >
            <div>
              <div className="num text-[46px] font-bold" style={{ color: 'var(--accent)' }}>5%</div>
              <div className="my-[6px] text-[15px] font-semibold">رسوم المنصة</div>
              <p className="text-[13px] text-muted-2">تُحتسب فقط عند نجاح الحملة. لا رسوم على الفشل.</p>
            </div>
            <div className="border-x px-[20px]" style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}>
              <div className="num text-[46px] font-bold" style={{ color: 'var(--blue)' }}>0</div>
              <div className="my-[6px] text-[15px] font-semibold">رسوم الإطلاق</div>
              <p className="text-[13px] text-muted-2">إنشاء وإطلاق مشروعك مجاني تماماً.</p>
            </div>
            <div>
              <div className="num text-[46px] font-bold" style={{ color: 'var(--pos)' }}>100%</div>
              <div className="my-[6px] text-[15px] font-semibold">استرداد مضمون</div>
              <p className="text-[13px] text-muted-2">يُعاد دعمك كاملاً إن لم يصل المشروع لهدفه.</p>
            </div>
          </div>
        </section>

        {/* faqs */}
        <section className="mx-auto mt-[60px] max-w-[820px] px-[26px]">
          <h2 className="mb-[24px] text-center text-[26px] font-bold">أسئلة شائعة</h2>
          {FAQS.map((f, i) => (
            <Card key={i} radius="card" className="mb-[12px] px-[22px] py-[20px]">
              <div className="mb-[9px] flex items-center gap-[10px]">
                <HelpCircle className="h-[20px] w-[20px]" style={{ color: 'var(--accent)' }} />
                <h3 className="text-[16px] font-bold">{f.q}</h3>
              </div>
              <p className="ps-[30px] text-[14px] leading-[1.7] text-muted">{f.a}</p>
            </Card>
          ))}
        </section>

        {/* cta */}
        <section className="mx-auto mt-[56px] max-w-(--container-creators) px-[26px]">
          <div
            className="rounded-(--radius-card-band) p-[50px] text-center"
            style={{ background: 'var(--cta-grad)', backgroundSize: '220% 220%', animation: 'wathba-gshift 9s ease infinite' }}
          >
            <h2 className="mb-[22px] text-[34px] font-bold" style={{ color: 'var(--on-accent)' }}>
              جاهز للوثبة التالية؟
            </h2>
            <div className="flex flex-wrap justify-center gap-[14px]">
              <Link
                href="/launch"
                className="btnp rounded-(--radius-btn) px-[30px] py-[15px] text-[16px] font-bold text-text"
                style={{ background: 'var(--on-accent)' }}
              >
                أطلق مشروعك
              </Link>
              <Link
                href="/explore"
                className="rounded-(--radius-btn) border px-[30px] py-[15px] text-[16px] font-bold"
                style={{ borderColor: 'rgba(6,18,31,0.4)', color: 'var(--on-accent)' }}
              >
                استكشف المشاريع
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function BackerStep({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Card radius="cardXl" className="p-[28px]">
      <div
        className="mb-[18px] grid h-[52px] w-[52px] place-items-center rounded-(--radius-card)"
        style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--gold)' }}
      >
        <Icon className="h-[26px] w-[26px]" />
      </div>
      <h3 className="mb-[9px] text-[18px] font-bold">{title}</h3>
      <p className="text-[14px] leading-[1.65] text-muted">{desc}</p>
    </Card>
  );
}

export const dynamic = 'force-static';
