'use client';

import { useState } from 'react';
import { CloudUpload, Lightbulb, CheckCircle2, PlusCircle, Pencil, Edit } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { categories } from '@/data/mock';
import { cn } from '@/lib/cn';

const STEPS = [
  { n: 1, icon: '✎',  label: 'الأساسيات' },
  { n: 2, icon: '🎯', label: 'الهدف' },
  { n: 3, icon: '📖', label: 'القصة' },
  { n: 4, icon: '🎁', label: 'المكافآت' },
  { n: 5, icon: '✓',  label: 'مراجعة' },
] as const;

export default function LaunchPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-launch) px-[26px] pt-[40px] pb-[60px]">
        <div className="num mb-[8px] text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
          START A PROJECT
        </div>
        <h1 className="mb-[8px] text-[34px] font-bold tracking-[-0.7px]">أطلق مشروعك على وثبة</h1>
        <p className="mb-[32px] text-[15px] text-muted">
          خمس خطوات تفصلك عن تحويل فكرتك إلى حملة تمويل ناجحة.
        </p>

        {/* stepper */}
        <div className="mb-[38px] flex items-center">
          {STEPS.map((s, i) => {
            const active = s.n === step;
            const done = s.n < step;
            return (
              <div key={s.n} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-[8px]">
                  <div
                    className="grid h-[46px] w-[46px] place-items-center rounded-(--radius-btn) text-[23px]"
                    style={{
                      background: active || done ? 'var(--accent)' : 'rgba(var(--ink-rgb),0.08)',
                      color: active || done ? 'var(--on-accent)' : 'var(--muted)',
                    }}
                  >
                    {s.icon}
                  </div>
                  <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: active ? 'var(--text)' : 'var(--muted)' }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mx-[10px] mb-[24px] h-[2px] flex-1" style={{ background: 'rgba(var(--ink-rgb),0.1)' }} />
                )}
              </div>
            );
          })}
        </div>

        <Card radius="cardXl" className="p-[32px]">
          {step === 1 && (
            <div>
              <h2 className="mb-[6px] text-[21px] font-bold">أساسيات المشروع</h2>
              <p className="mb-[24px] text-[13.5px] text-muted-2">ابدأ بالاسم والفئة — هذه أول ما يراه الداعمون.</p>
              <Field label="عنوان المشروع" placeholder="مثال: سِرب — درون التصوير الذكي" />
              <Field label="الوصف المختصر" placeholder="جملة واحدة تلخّص مشروعك" />
              <label className="mb-[10px] block text-[13.5px] font-semibold text-text-soft">الفئة</label>
              <div className="flex flex-wrap gap-[10px]">
                {categories.map((c) => {
                  const sel = selectedCat === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCat(c.id)}
                      className="chip inline-flex items-center gap-[7px] rounded-(--radius-pill) border px-[16px] py-[10px] text-[13.5px] font-semibold"
                      style={{
                        background: sel ? 'rgba(var(--accent-rgb),0.10)' : 'rgba(var(--ink-rgb),0.04)',
                        borderColor: sel ? 'var(--accent)' : 'rgba(var(--ink-rgb),0.1)',
                        color: sel ? 'var(--accent)' : 'var(--muted)',
                      }}
                    >
                      {c.ar}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-[6px] text-[21px] font-bold">هدف التمويل</h2>
              <p className="mb-[24px] text-[13.5px] text-muted-2">حدّد مبلغاً واقعياً يغطّي تكاليف تنفيذ مشروعك.</p>
              <div className="mb-[24px] grid grid-cols-2 gap-[18px]">
                <div>
                  <label className="mb-[8px] block text-[13.5px] font-semibold text-text-soft">هدف التمويل (بالريال)</label>
                  <div
                    className="flex items-center rounded-(--radius-pad) border px-[14px]"
                    style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
                  >
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>﷼</span>
                    <input defaultValue="1,500,000" className="num flex-1 bg-transparent px-[8px] py-[14px] text-[18px] font-bold" />
                  </div>
                </div>
                <div>
                  <label className="mb-[8px] block text-[13.5px] font-semibold text-text-soft">مدة الحملة (يوم)</label>
                  <div
                    className="flex items-center rounded-(--radius-pad) border px-[14px]"
                    style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
                  >
                    <input defaultValue="30" className="num flex-1 bg-transparent px-[8px] py-[14px] text-[18px] font-bold" />
                    <span className="text-[13px] text-muted-2">يوم</span>
                  </div>
                </div>
              </div>
              <div
                className="flex gap-[14px] rounded-(--radius-btn) border p-[18px]"
                style={{ background: 'rgba(var(--accent-rgb),0.05)', borderColor: 'rgba(var(--accent-rgb),0.18)' }}
              >
                <Lightbulb className="h-[24px] w-[24px] flex-shrink-0" style={{ color: 'var(--accent)' }} />
                <div>
                  <div className="mb-[5px] text-[14px] font-bold">نموذج «الكل أو لا شيء» مع عتبة ٨٠٪</div>
                  <p className="text-[13px] leading-[1.6] text-muted">
                    لن تتلقى أي تمويل إلا إذا بلغت ٨٠٪ من هدفك خلال المدة المحددة — هذا يحمي الداعمين
                    ويبني الثقة. المبلغ الأكبر يصبح "هدف امتداد" تلقائياً.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-[6px] text-[21px] font-bold">القصة والوسائط</h2>
              <p className="mb-[24px] text-[13.5px] text-muted-2">المشاريع ذات الفيديو تجمع تمويلاً أكثر بنسبة ٨٥٪.</p>
              <div
                className="btng mb-[20px] cursor-pointer rounded-(--radius-card) border-[2px] border-dashed p-[36px] text-center"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.15)' }}
              >
                <CloudUpload className="mx-auto h-[40px] w-[40px]" style={{ color: 'var(--accent)' }} />
                <div className="mt-[12px] text-[15px] font-semibold">اسحب فيديو أو صور المشروع هنا</div>
                <div className="mt-[5px] text-[12.5px] text-muted-2">MP4، PNG، JPG — حتى 200MB</div>
              </div>
              <label className="mb-[8px] block text-[13.5px] font-semibold text-text-soft">قصة المشروع</label>
              <textarea
                placeholder="احكِ قصتك: ما المشكلة التي تحلّها؟ من أنت؟ لماذا الآن؟"
                className="min-h-[140px] w-full resize-y rounded-(--radius-pad) border p-[14px] text-[14.5px] leading-[1.7]"
                style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
              />
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="mb-[6px] text-[21px] font-bold">مستويات المكافآت</h2>
              <p className="mb-[24px] text-[13.5px] text-muted-2">امنح داعميك أسباباً للمشاركة على مستويات مختلفة.</p>
              {[
                { p: 75, t: 'الداعم الأول',   d: 'شكر شخصي من المبدع.' },
                { p: 750, t: 'الإصدار المبكر', d: 'وحدة من المنتج + شحن مجاني.' },
                { p: 2400, t: 'حزمة الاستوديو', d: 'حزمة احترافية + ملحقات.' },
              ].map((t, i) => (
                <div
                  key={i}
                  className="mb-[13px] flex items-center gap-[16px] rounded-(--radius-btn) border p-[18px]"
                  style={{ background: 'rgba(var(--ink-rgb),0.03)', borderColor: 'rgba(var(--ink-rgb),0.1)' }}
                >
                  <div
                    className="num grid h-[64px] w-[64px] place-items-center rounded-(--radius-brand) text-[18px] font-bold"
                    style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}
                  >
                    {t.p} ر.س
                  </div>
                  <div className="flex-1">
                    <div className="mb-[3px] text-[15px] font-bold">{t.t}</div>
                    <div className="text-[13px] text-muted">{t.d}</div>
                  </div>
                  <Pencil className="h-[20px] w-[20px] cursor-pointer text-muted-2" />
                </div>
              ))}
              <button
                className="btng flex w-full items-center justify-center gap-[8px] rounded-(--radius-btn) border-[1.5px] border-dashed p-[16px] text-[14px] font-semibold"
                style={{ borderColor: 'rgba(var(--accent-rgb),0.3)', color: 'var(--accent)' }}
              >
                <PlusCircle className="h-[20px] w-[20px]" />
                أضف مستوى مكافأة جديد
              </button>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="mb-[6px] text-[21px] font-bold">مراجعة وإطلاق</h2>
              <p className="mb-[24px] text-[13.5px] text-muted-2">راجع التفاصيل النهائية قبل الإطلاق.</p>
              <div className="mb-[18px] grid grid-cols-2 gap-[14px]">
                <SummaryTile label="العنوان" value="سِرب — درون التصوير الذكي" />
                <SummaryTile label="الفئة" value="تقنية" />
                <SummaryTile label="الهدف" value="1,500,000 ر.س" accent />
                <SummaryTile label="المدة" value="٣٠ يوم" num />
              </div>
              <div
                className="flex items-center gap-[14px] rounded-(--radius-btn) border p-[18px]"
                style={{
                  background: 'linear-gradient(120deg,rgba(var(--accent2-rgb),0.12),rgba(var(--accent-rgb),0.12))',
                  borderColor: 'rgba(var(--accent-rgb),0.25)',
                }}
              >
                <CheckCircle2 className="h-[28px] w-[28px]" style={{ color: 'var(--pos)' }} />
                <div>
                  <div className="text-[15px] font-bold">مشروعك جاهز للإطلاق!</div>
                  <div className="text-[13px] text-muted">سيخضع لمراجعة سريعة خلال ٢٤ ساعة قبل النشر.</div>
                </div>
              </div>
              {/* silence unused */}
              <Edit className="hidden" />
            </div>
          )}

          <div
            className="mt-[28px] flex gap-[12px] border-t pt-[24px]"
            style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}
          >
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as typeof step)}
                className="btng rounded-(--radius-brand) border px-[26px] py-[14px] text-[15px] font-semibold text-muted"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.16)' }}
              >
                رجوع
              </button>
            )}
            <button
              onClick={() => step < 5 && setStep((step + 1) as typeof step)}
              className={cn('btnp flex-1 rounded-(--radius-brand) py-[14px] text-[15px] font-bold text-on-accent')}
              style={{ background: 'var(--grad)' }}
            >
              {step === 5 ? 'إرسال للمراجعة' : 'التالي'}
            </button>
          </div>
        </Card>
      </main>
      <Footer />
    </>
  );
}

function Field(props: { label: string; placeholder?: string }) {
  return (
    <div className="mb-[20px]">
      <label className="mb-[8px] block text-[13.5px] font-semibold text-text-soft">{props.label}</label>
      <input
        placeholder={props.placeholder}
        className="w-full rounded-(--radius-pad) border p-[14px] text-[15px]"
        style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
      />
    </div>
  );
}

function SummaryTile({ label, value, accent, num }: { label: string; value: string; accent?: boolean; num?: boolean }) {
  return (
    <div
      className="rounded-(--radius-brand) border p-[16px]"
      style={{ background: 'rgba(var(--ink-rgb),0.03)', borderColor: 'rgba(var(--ink-rgb),0.08)' }}
    >
      <div className="mb-[5px] text-[12px] text-muted-2">{label}</div>
      <div
        className={cn('text-[15px] font-bold', num && 'num')}
        style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}
      >
        {value}
      </div>
    </div>
  );
}
