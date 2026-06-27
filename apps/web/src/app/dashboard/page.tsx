'use client';

import { useState } from 'react';
import { Eye, Megaphone, Group, Settings as SettingsIcon, DollarSign, TrendingUp, Users, Clock, Edit, Check } from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { ButtonLink } from '@/components/Button';
import { useTheme } from '@/providers/ThemeProvider';

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: TrendingUp },
  { id: 'backers',  label: 'الداعمون',   icon: Group },
  { id: 'updates',  label: 'التحديثات',   icon: Megaphone },
  { id: 'settings', label: 'الإعدادات',   icon: SettingsIcon },
] as const;

const STATS = [
  { label: 'إجمالي التمويل', value: '2.56M ر.س', delta: '+12% هذا الأسبوع', icon: DollarSign,  color: 'var(--accent)' },
  { label: 'الداعمون',       value: '3,247',     delta: '+40 اليوم',         icon: Users,       color: 'var(--blue)'   },
  { label: 'نسبة الإنجاز',    value: '171%',      delta: 'تجاوز الهدف',       icon: TrendingUp,  color: 'var(--purple)' },
  { label: 'أيام متبقية',    value: '12',        delta: 'حملة نشطة',         icon: Clock,       color: 'var(--gold)'   },
];

const BARS: Array<{ d: string; h: string; v: string }> = [
  { d: 'سبت',    h: '40%', v: '٤٢K' },
  { d: 'أحد',    h: '55%', v: '٥٨K' },
  { d: 'اثنين',  h: '72%', v: '٧٦K' },
  { d: 'ثلاثاء', h: '90%', v: '٩٢K' },
  { d: 'أربعاء', h: '65%', v: '٧٠K' },
  { d: 'خميس',   h: '80%', v: '٨٤K' },
  { d: 'جمعة',   h: '95%', v: '٩٨K' },
];

const RECENT = [
  { initial: 'أ', name: 'أحمد القاسم',  time: 'قبل دقيقة',   amount: '٧٥٠ ر.س',   rank: 'سفير',  rc: 'var(--gold)'   },
  { initial: 'س', name: 'سارة العامري', time: 'قبل ١٠ دقائق', amount: '٢٤٠ ر.س',   rank: 'مناصِر', rc: 'var(--accent)' },
  { initial: 'ف', name: 'فهد المرّي',   time: 'قبل ساعة',     amount: '٧٥ ر.س',    rank: 'داعم',  rc: 'var(--blue)'   },
  { initial: 'ن', name: 'نورة الزهراني',time: 'قبل ٣ ساعات',  amount: '٧٥٠ ر.س',   rank: 'مناصِر', rc: 'var(--accent)' },
  { initial: 'ع', name: 'علي الحربي',   time: 'قبل ٥ ساعات',  amount: '٢,٤٠٠ ر.س', rank: 'سفير',  rc: 'var(--gold)'   },
];

export default function DashboardPage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('overview');
  const { theme, setTheme } = useTheme();
  const [notifBackers, setNotifBackers] = useState(true);
  const [showTransparency, setShowTransparency] = useState(true);
  return (
    <>
      <Header />
      <main>
        <section className="mx-auto max-w-(--container-app) px-[26px] pt-[36px]">
          <div className="mb-[26px] flex flex-wrap items-center justify-between gap-[14px]">
            <div className="flex items-center gap-[14px]">
              <div
                className="grid h-[54px] w-[54px] place-items-center rounded-(--radius-card) text-[22px] font-bold"
                style={{ background: 'var(--grad)', color: 'var(--on-accent)' }}
              >س</div>
              <div>
                <div className="num text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
                  CREATOR DASHBOARD
                </div>
                <h1 className="text-[26px] font-bold">لوحة تحكم سِرب</h1>
              </div>
            </div>
            <div className="flex gap-[11px]">
              <ButtonLink href="/projects/sirb" variant="outline" size="sm">
                <Eye className="h-[18px] w-[18px]" /> عرض الصفحة
              </ButtonLink>
              <ButtonLink href="#" size="sm">
                <Megaphone className="h-[18px] w-[18px]" /> نشر تحديث
              </ButtonLink>
            </div>
          </div>

          <div className="mb-[28px] flex gap-[10px] border-b" style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}>
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="-mb-[1px] flex items-center gap-[7px] border-b-[2px] px-[16px] py-[11px] text-[14px] font-semibold"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  <t.icon className="h-[18px] w-[18px]" />{t.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-(--container-app) px-[26px] pb-[10px]">
          {tab === 'overview' && (
            <div>
              <div className="mb-[24px] grid gap-[16px] sm:grid-cols-2 md:grid-cols-4">
                {STATS.map((s) => (
                  <Card key={s.label} radius="card" lift className="p-[20px]">
                    <div className="mb-[14px] flex items-center justify-between">
                      <span className="text-[13px] text-muted">{s.label}</span>
                      <div
                        className="grid h-[36px] w-[36px] place-items-center rounded-(--radius-lg)"
                        style={{ background: 'rgba(var(--ink-rgb),0.05)', color: s.color }}
                      >
                        <s.icon className="h-[20px] w-[20px]" />
                      </div>
                    </div>
                    <div className="num mb-[6px] text-[28px] font-bold">{s.value}</div>
                    <div className="text-[12px] font-semibold" style={{ color: s.color }}>{s.delta}</div>
                  </Card>
                ))}
              </div>
              <div className="grid gap-[18px] md:grid-cols-[1.5fr_1fr]">
                <Card radius="cardLg" className="p-[24px]">
                  <div className="mb-[24px] flex items-center justify-between">
                    <h3 className="text-[17px] font-bold">التمويل اليومي</h3>
                    <span className="num text-[13px] text-muted-2">آخر ٧ أيام</span>
                  </div>
                  <div className="flex h-[200px] items-end justify-between gap-[12px]">
                    {BARS.map((b) => (
                      <div key={b.d} className="flex h-full flex-1 flex-col items-center justify-end gap-[9px]">
                        <span className="num text-[11px] font-semibold text-muted">{b.v}</span>
                        <div
                          className="w-full rounded-t-[8px]"
                          style={{ height: b.h, background: 'var(--grad-barv)', minHeight: 8 }}
                        />
                        <span className="text-[11px] text-muted-2">{b.d}</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card radius="cardLg" className="p-[24px]">
                  <h3 className="mb-[18px] text-[17px] font-bold">داعمون جدد</h3>
                  {RECENT.map((r) => (
                    <div key={r.name} className="mb-[16px] flex items-center gap-[11px]">
                      <div
                        className="grid h-[38px] w-[38px] flex-shrink-0 place-items-center rounded-(--radius-lg) border font-bold"
                        style={{ background: 'var(--avatar)', borderColor: 'rgba(var(--ink-rgb),0.1)' }}
                      >
                        {r.initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="overflow-hidden text-[13.5px] font-semibold text-ellipsis whitespace-nowrap">{r.name}</div>
                        <div className="text-[11.5px] text-muted-2">{r.time}</div>
                      </div>
                      <div className="num text-[14px] font-bold" style={{ color: 'var(--accent)' }}>{r.amount}</div>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {tab === 'backers' && (
            <Card radius="cardLg" className="overflow-hidden p-0">
              <div
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-[14px] border-b px-[24px] py-[16px] text-[12px] font-semibold text-muted-2"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.08)' }}
              >
                <span>الداعم</span><span>المكافأة</span><span>المبلغ</span><span>الرتبة</span>
              </div>
              {RECENT.map((r) => (
                <div
                  key={r.name}
                  className="grid grid-cols-[2fr_1.5fr_1fr_1fr] items-center gap-[14px] border-b px-[24px] py-[16px]"
                  style={{ borderColor: 'rgba(var(--ink-rgb),0.04)' }}
                >
                  <div className="flex items-center gap-[11px]">
                    <div
                      className="grid h-[36px] w-[36px] place-items-center rounded-(--radius-md) border font-bold"
                      style={{ background: 'var(--avatar)', borderColor: 'rgba(var(--ink-rgb),0.1)' }}
                    >
                      {r.initial}
                    </div>
                    <span className="text-[14px] font-semibold">{r.name}</span>
                  </div>
                  <span className="text-[13px] text-muted">الإصدار المبكر</span>
                  <span className="num text-[14px] font-bold" style={{ color: 'var(--accent)' }}>{r.amount}</span>
                  <span
                    className="w-fit rounded-(--radius-pill) border px-[11px] py-[3px] text-[11.5px] font-bold"
                    style={{ color: r.rc, borderColor: r.rc }}
                  >
                    {r.rank}
                  </span>
                </div>
              ))}
            </Card>
          )}

          {tab === 'updates' && (
            <div className="space-y-[14px]">
              {[1, 2, 3, 4].map((n) => (
                <Card key={n} radius="card" className="flex items-center gap-[16px] p-[20px]">
                  <div
                    className="num grid h-[40px] w-[40px] place-items-center rounded-(--radius-lg) text-[14px] font-bold"
                    style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}
                  >
                    #{toArabicDigits(n)}
                  </div>
                  <div className="flex-1">
                    <div className="text-[16px] font-bold">تحديث رقم {toArabicDigits(n)}</div>
                    <div className="num text-[12px] text-muted-2">٢٠٢٦/٠٦/{toArabicDigits(n + 10)}</div>
                  </div>
                  <Edit className="h-[20px] w-[20px] cursor-pointer text-muted-2" />
                </Card>
              ))}
            </div>
          )}

          {tab === 'settings' && (
            <Card radius="cardLg" className="max-w-[620px] p-[28px]">
              <h3 className="mb-[20px] text-[18px] font-bold">إعدادات المشروع</h3>

              {/* theme picker — 2-col swatches with selected check (design lines 1034–1046) */}
              <div className="mb-[22px]">
                <label className="mb-[10px] block text-[13.5px] font-semibold text-text-soft">نمط الألوان</label>
                <div className="grid grid-cols-2 gap-[12px]">
                  {(['light', 'dark'] as const).map((opt) => {
                    const active = theme === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setTheme(opt)}
                        className="flex items-center gap-[12px] rounded-(--radius-btn) border-[1.5px] p-[14px]"
                        style={{
                          background: 'rgba(var(--ink-rgb),0.02)',
                          borderColor: active ? 'var(--accent)' : 'rgba(var(--ink-rgb),0.1)',
                        }}
                      >
                        <div className="flex gap-[4px]">
                          <span
                            className="h-[30px] w-[18px] rounded-[5px] border"
                            style={{
                              background: opt === 'light' ? '#ffffff' : '#0c1c2f',
                              borderColor: opt === 'light' ? 'rgba(0,0,0,0.12)' : 'transparent',
                            }}
                          />
                          <span
                            className="h-[30px] w-[18px] rounded-[5px]"
                            style={{ background: opt === 'light' ? '#05a661' : '#22d3ee' }}
                          />
                        </div>
                        <div className="text-start">
                          <div className="text-[14px] font-bold">{opt === 'light' ? 'فاتح' : 'داكن'}</div>
                          <div className="text-[11.5px] text-muted-2">
                            {opt === 'light' ? 'مريح وكلاسيكي' : 'عصري وجريء'}
                          </div>
                        </div>
                        {active && (
                          <Check
                            className="ms-auto h-[20px] w-[20px]"
                            style={{ color: 'var(--accent)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* project title field */}
              <div className="mb-[18px]">
                <label className="mb-[8px] block text-[13.5px] font-semibold text-text-soft">عنوان المشروع</label>
                <input
                  defaultValue="سِرب — درون التصوير الذكي"
                  className="w-full rounded-(--radius-lg) border px-[14px] py-[12px] text-[14px]"
                  style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
                />
              </div>

              {/* switch rows */}
              <SwitchRow
                label="إشعارات الداعمين"
                hint="أرسل بريداً لكل داعم عند نشر تحديث"
                on={notifBackers}
                onToggle={() => setNotifBackers((v) => !v)}
              />
              <SwitchRow
                label="عرض لوحة الشفافية"
                hint="اجعل توزيع الميزانية مرئياً للجميع"
                on={showTransparency}
                onToggle={() => setShowTransparency((v) => !v)}
              />
            </Card>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function SwitchRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="mb-[12px] flex items-center justify-between rounded-(--radius-pad) border p-[16px]"
      style={{ background: 'rgba(var(--ink-rgb),0.03)', borderColor: 'rgba(var(--ink-rgb),0.08)' }}
    >
      <div>
        <div className="text-[14px] font-semibold">{label}</div>
        <div className="text-[12px] text-muted-2">{hint}</div>
      </div>
      <button
        onClick={onToggle}
        aria-pressed={on}
        className="relative h-[26px] w-[46px] flex-shrink-0 rounded-[20px]"
        style={{ background: on ? 'var(--grad)' : 'rgba(var(--ink-rgb),0.15)' }}
      >
        <span
          className="absolute top-[3px] h-[20px] w-[20px] rounded-full transition-all"
          style={{
            background: 'var(--on-accent)',
            ...(on ? { right: 3, left: 'auto' } : { left: 3, right: 'auto' }),
          }}
        />
      </button>
    </div>
  );
}

