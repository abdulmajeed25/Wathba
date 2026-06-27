'use client';

import { useState, use as useUnwrap } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, CreditCard, Lock, ShieldCheck, Wallet, Award,
} from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { trendingProjects } from '@/data/mock';
import { cn } from '@/lib/cn';

type StepKey = 'tier' | 'info' | 'payment' | 'done';

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'tier',    label: 'المكافأة' },
  { key: 'info',    label: 'البيانات' },
  { key: 'payment', label: 'الدفع' },
  { key: 'done',    label: 'انتهى' },
];

const SAMPLE_TIERS = [
  { id: 't1', amount: 75,    title: 'الداعم الأول', desc: 'شكر شخصي + تحديثات حصرية.',                            backers: 412  },
  { id: 't2', amount: 750,   title: 'الإصدار المبكر', desc: 'وحدة من المنتج + شحن مجاني داخل الخليج.',                  backers: 1840 },
  { id: 't3', amount: 2_400, title: 'حزمة الاستوديو', desc: 'حزمة احترافية كاملة + ملحقات حصرية.',                       backers: 312  },
  { id: 't4', amount: 7_500, title: 'الراعي الذهبي', desc: 'اسمك على المنتج + عشاء حصري مع الفريق.',                     backers: 38   },
];

export default function PledgeFlow({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  const { projectId } = useUnwrap(params);
  const { tier: initialTier } = useUnwrap(searchParams);

  const project = trendingProjects.find((p) => p.id === projectId) ?? trendingProjects[0]!;
  const [step, setStep] = useState<StepKey>(initialTier ? 'info' : 'tier');
  const [selectedTier, setSelectedTier] = useState<string | undefined>(initialTier);
  const tier = SAMPLE_TIERS.find((t) => t.id === selectedTier);
  const idx = STEPS.findIndex((s) => s.key === step);

  const next = () => {
    if (step === 'tier' && selectedTier) setStep('info');
    else if (step === 'info') setStep('payment');
    else if (step === 'payment') setStep('done');
  };
  const back = () => {
    if (idx > 0) setStep(STEPS[idx - 1]!.key);
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-card) px-[26px] pt-[40px] pb-[60px]">
        <Link href={`/projects/${projectId}`} className="navlink mb-[20px] inline-flex items-center gap-[6px] text-[13px] text-muted">
          <ArrowRight className="h-[17px] w-[17px]" />عودة للمشروع
        </Link>
        <h1 className="mb-[6px] text-[32px] font-bold tracking-[-0.6px]">ادعم: {project.titleAr}</h1>
        <p className="mb-[30px] text-[14.5px] text-muted">دعمك مؤمَّن — لن يُخصم أي مبلغ إلا عند نجاح المشروع.</p>

        {/* stepper */}
        <div className="mb-[36px] flex items-center">
          {STEPS.map((s, i) => {
            const active = s.key === step;
            const done = i < idx || step === 'done';
            return (
              <div key={s.key} className="flex flex-1 items-center">
                <div className="flex items-center gap-[10px]">
                  <div
                    className="num grid h-[34px] w-[34px] place-items-center rounded-full text-[14px] font-bold"
                    style={{
                      background: active || done ? 'var(--accent)' : 'rgba(var(--ink-rgb),0.08)',
                      color: active || done ? 'var(--on-accent)' : 'var(--muted)',
                    }}
                  >
                    {done && !active ? '✓' : toArabicDigits(i + 1)}
                  </div>
                  <span className="text-[13.5px] font-semibold whitespace-nowrap" style={{ color: active ? 'var(--text)' : 'var(--muted)' }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mx-[14px] h-[2px] flex-1" style={{ background: 'rgba(var(--ink-rgb),0.1)' }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="grid items-start gap-[28px] pb-[10px] md:grid-cols-[1.5fr_1fr]">
          <div>
            {step === 'tier' && (
              <div>
                <h2 className="mb-[16px] text-[21px] font-bold">اختر مستوى الدعم</h2>
                <div className="space-y-[13px]">
                  {SAMPLE_TIERS.map((t) => {
                    const sel = t.id === selectedTier;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTier(t.id)}
                        className="block w-full rounded-(--radius-card) border p-[18px] text-right transition-all"
                        style={{
                          background: sel ? 'rgba(var(--accent-rgb),0.06)' : 'var(--card)',
                          borderColor: sel ? 'var(--accent)' : 'rgba(var(--ink-rgb),0.09)',
                          borderWidth: 1.5,
                        }}
                      >
                        <div className="mb-[7px] flex items-center justify-between">
                          <div className="flex items-center gap-[10px]">
                            <span className="num text-[20px] font-bold" style={{ color: 'var(--accent)' }}>
                              {t.amount.toLocaleString('en-US')} ر.س
                            </span>
                            <h4 className="text-[16px] font-bold">{t.title}</h4>
                          </div>
                          <span className="num text-[12px] text-muted-2">{toArabicDigits(t.backers)} داعم</span>
                        </div>
                        <p className="text-[13.5px] leading-[1.6] text-muted">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 'info' && (
              <div>
                <h2 className="mb-[18px] text-[21px] font-bold">معلومات الشحن والتواصل</h2>
                <div className="mb-[14px] grid grid-cols-2 gap-[14px]">
                  <Field label="الاسم الكامل" placeholder="مثال: سارة العامري" />
                  <Field label="البريد الإلكتروني" placeholder="you@email.com" type="email" />
                </div>
                <Field label="العنوان" placeholder="الشارع، المبنى، الشقة" />
                <div className="grid grid-cols-3 gap-[14px]">
                  <Field label="المدينة" />
                  <Field label="الدولة" defaultValue="السعودية" />
                  <Field label="الرمز البريدي" />
                </div>
              </div>
            )}

            {step === 'payment' && (
              <div>
                <h2 className="mb-[18px] text-[21px] font-bold">طريقة الدفع</h2>
                <div className="mb-[20px] flex gap-[11px]">
                  <div
                    className="flex flex-1 cursor-pointer items-center gap-[10px] rounded-(--radius-brand) border p-[15px]"
                    style={{ background: 'rgba(var(--accent-rgb),0.06)', borderColor: 'var(--accent)', borderWidth: 1.5 }}
                  >
                    <CreditCard className="h-[22px] w-[22px]" style={{ color: 'var(--accent)' }} />
                    <span className="text-[14px] font-semibold">بطاقة ائتمان</span>
                  </div>
                  <div
                    className="btng flex flex-1 cursor-pointer items-center gap-[10px] rounded-(--radius-brand) border p-[15px]"
                    style={{ background: 'rgba(var(--ink-rgb),0.03)', borderColor: 'rgba(var(--ink-rgb),0.1)' }}
                  >
                    <Wallet className="h-[22px] w-[22px] text-muted" />
                    <span className="text-[14px] font-semibold text-muted">محفظة رقمية</span>
                  </div>
                </div>
                <div className="mb-[14px]">
                  <label className="mb-[7px] block text-[13px] text-muted">رقم البطاقة</label>
                  <div
                    className="flex items-center rounded-(--radius-lg) border px-[14px]"
                    style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
                  >
                    <input defaultValue="4242 4242 4242 4242" className="num flex-1 bg-transparent py-[12px] text-[14px]" />
                    <Lock className="h-[20px] w-[20px]" style={{ color: 'var(--accent)' }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-[14px]">
                  <Field label="تاريخ الانتهاء" defaultValue="08 / 28" num />
                  <Field label="CVC" defaultValue="•••" />
                </div>
                <div
                  className="mt-[18px] flex items-center gap-[9px] rounded-(--radius-lg) border p-[12px] text-[12.5px]"
                  style={{ background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.18)', color: 'var(--pos)' }}
                >
                  <ShieldCheck className="h-[18px] w-[18px]" />
                  الدفع مشفّر بالكامل. لن يُخصم المبلغ إلا عند نجاح المشروع.
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="py-[24px] text-center">
                <div
                  className="mx-auto mb-[24px] grid h-[90px] w-[90px] place-items-center rounded-full"
                  style={{ background: 'var(--grad)', color: 'var(--on-accent)', boxShadow: '0 0 50px -10px rgba(var(--accent-rgb),0.6)' }}
                >
                  <CheckCircle2 className="h-[48px] w-[48px]" />
                </div>
                <h2 className="mb-[12px] text-[30px] font-bold">شكراً لدعمك! 🎉</h2>
                <p className="mx-auto mb-[22px] max-w-[440px] text-[16px] text-text-soft">
                  أصبحت الآن داعماً لـ«{project.titleAr}». سنوافيك بكل التحديثات على بريدك.
                </p>
                <div
                  className="mb-[28px] inline-flex items-center gap-[10px] rounded-(--radius-btn) border px-[22px] py-[14px]"
                  style={{ background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.3)' }}
                >
                  <Award className="h-[26px] w-[26px]" style={{ color: 'var(--gold)' }} fill="currentColor" />
                  <div className="text-right">
                    <div className="text-[13px] text-muted">ارتقت رتبتك إلى</div>
                    <div className="text-[17px] font-bold" style={{ color: 'var(--gold)' }}>داعم</div>
                  </div>
                </div>
                <div className="flex justify-center gap-[12px]">
                  <Link href="/profile" className="btnp rounded-(--radius-brand) px-[24px] py-[13px] text-[15px] font-bold text-on-accent" style={{ background: 'var(--grad)' }}>
                    ملفي الشخصي
                  </Link>
                  <Link href="/explore" className="btng rounded-(--radius-brand) border px-[24px] py-[13px] text-[15px] font-semibold" style={{ borderColor: 'rgba(var(--ink-rgb),0.16)' }}>
                    استكشف المزيد
                  </Link>
                </div>
              </div>
            )}

            {step !== 'done' && (
              <div className="mt-[26px] flex gap-[12px]">
                {idx > 0 && (
                  <button
                    onClick={back}
                    className="btng rounded-(--radius-brand) border px-[24px] py-[14px] text-[15px] font-semibold text-muted"
                    style={{ borderColor: 'rgba(var(--ink-rgb),0.16)' }}
                  >
                    رجوع
                  </button>
                )}
                <button
                  onClick={next}
                  disabled={step === 'tier' && !selectedTier}
                  className={cn(
                    'btnp flex-1 rounded-(--radius-brand) py-[14px] text-[15px] font-bold text-on-accent',
                    step === 'tier' && !selectedTier && 'cursor-not-allowed opacity-60',
                  )}
                  style={{ background: 'var(--grad)' }}
                >
                  {step === 'payment' ? 'تأكيد الدعم' : 'التالي'}
                </button>
              </div>
            )}
          </div>

          {/* order summary */}
          {step !== 'done' && tier && (
            <Card radius="cardLg" className="sticky top-[90px] self-start p-[22px]">
              <div className="mb-[16px] text-[14px] font-bold">ملخص الدعم</div>
              <div
                className="ph mb-[16px] h-[120px] rounded-(--radius-brand)"
                style={{ background: 'var(--ph-bg)' }}
              />
              <div className="mb-[4px] text-[15px] font-bold">{project.titleAr}</div>
              <div className="mb-[18px] text-[12.5px] text-muted-2">بواسطة {project.creator}</div>
              <div className="border-t pt-[16px]" style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}>
                <Row label={tier.title} value={`${tier.amount.toLocaleString('en-US')} ر.س`} />
                <Row label="الشحن" value="٢٥ ر.س" />
                <div className="mt-[4px] border-t pt-[14px]" style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}>
                  <Row label="الإجمالي" value={`${(tier.amount + 25).toLocaleString('en-US')} ر.س`} accent />
                </div>
              </div>
              <div
                className="mt-[16px] flex items-center gap-[8px] rounded-(--radius-lg) border p-[12px] text-[11.5px] text-muted-2"
                style={{ background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.18)' }}
              >
                <Award className="h-[16px] w-[16px]" style={{ color: 'var(--gold)' }} fill="currentColor" />
                هذا الدعم يمنحك رتبة «داعم»
              </div>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Field(props: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  num?: boolean;
}) {
  return (
    <div className="mb-[14px]">
      <label className="mb-[7px] block text-[13px] text-muted">{props.label}</label>
      <input
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
        className={cn('w-full rounded-(--radius-lg) border px-[14px] py-[12px] text-[14px] text-text', props.num && 'num')}
        style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
      />
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="mb-[11px] flex justify-between text-[14px]">
      <span style={{ color: accent ? 'var(--text)' : 'var(--muted)' }} className={cn(accent && 'text-[18px] font-bold')}>
        {label}
      </span>
      <span className={cn('num font-semibold', accent && 'text-[18px] font-bold')} style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}>
        {value}
      </span>
    </div>
  );
}
