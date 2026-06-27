'use client';

import { useState } from 'react';
import { ClipboardCheck, IdCard, BadgeCheck } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Button } from '@/components/Button';
import { trendingProjects } from '@/data/mock';

const TABS = [
  { id: 'review',  label: 'مراجعة المشاريع', icon: ClipboardCheck },
  { id: 'kyc',     label: 'تحقق الهويات',    icon: IdCard },
  { id: 'partner', label: 'بشراكة وثبة',     icon: BadgeCheck },
] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('review');

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-app) px-[26px] pt-[40px] pb-[60px]">
        <div className="num mb-[6px] text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
          ADMIN CONSOLE
        </div>
        <h1 className="mb-[6px] text-[32px] font-bold tracking-[-0.6px]">لوحة الإدارة</h1>
        <p className="mb-[26px] text-[14px] text-muted">
          مراجعة المشاريع، تحقق الهويات، وإدارة شراكات وثبة.
        </p>

        <div
          className="mb-[24px] inline-flex gap-[9px] rounded-(--radius-brand) border p-[5px]"
          style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.08)' }}
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-[7px] rounded-(--radius-sm) px-[15px] py-[8px] text-[13.5px] font-semibold"
                style={{
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--muted)',
                }}
              >
                <t.icon className="h-[16px] w-[16px]" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'review' && (
          <div className="space-y-[14px]">
            {trendingProjects.slice(0, 3).map((p) => (
              <Card key={p.id} radius="cardLg" className="p-[20px]">
                <div className="mb-[12px] flex gap-[14px]">
                  <div className="ph h-[56px] w-[56px] flex-shrink-0 rounded-(--radius-btn)" style={{ background: 'var(--ph-bg)' }} />
                  <div className="flex-1">
                    <h3 className="text-[16px] font-bold">{p.titleAr}</h3>
                    <p className="text-[11.5px] text-muted-2">بواسطة {p.creator}</p>
                    <p className="num mt-[4px] text-[13px] text-muted">
                      هدف {(p.goalHalalas / 100).toLocaleString('en-US')} ر.س
                    </p>
                  </div>
                  <Pill tone="gold">بانتظار المراجعة</Pill>
                </div>
                <p className="mb-[14px] text-[13px] text-text-soft">{p.shortDescAr}</p>
                <div className="flex gap-[10px]">
                  <Button size="sm" className="flex-1">اعتماد + نشر</Button>
                  <Button size="sm" variant="outline" className="flex-1">رفض + إرجاع</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'kyc' && (
          <div className="space-y-[14px]">
            {['أحمد القاسم', 'سارة العامري', 'فهد المرّي'].map((name) => (
              <Card key={name} radius="cardLg" className="flex items-center gap-[12px] p-[16px]">
                <div
                  className="grid h-[44px] w-[44px] place-items-center rounded-(--radius-pad) font-bold"
                  style={{ background: 'rgba(var(--ink-rgb),0.08)' }}
                >
                  {name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{name}</div>
                  <div className="num text-[11.5px] text-muted-2">+٩٦٦ ٥X XXX XXXX</div>
                </div>
                <Button variant="outline" size="sm">تأكيد يدوي</Button>
              </Card>
            ))}
          </div>
        )}

        {tab === 'partner' && (
          <div className="space-y-[14px]">
            <div
              className="flex items-start gap-[10px] rounded-(--radius-btn) border p-[14px]"
              style={{ background: 'rgba(var(--purple-rgb),0.08)', borderColor: 'rgba(var(--purple-rgb),0.30)' }}
            >
              <BadgeCheck className="h-[22px] w-[22px] flex-shrink-0" style={{ color: 'var(--purple)' }} />
              <p className="text-[13px] leading-[1.6] text-text-soft">
                وسم «بشراكة وثبة» يجب أن يكون مرئياً للداعمين على البطاقة وصفحة التفاصيل. هذا التزام
                قانوني/أخلاقي بالشفافية (§7).
              </p>
            </div>
            {trendingProjects.map((p) => {
              const partnered = !!p.platformPartner;
              return (
                <Card key={p.id} radius="cardLg" className="flex items-center gap-[12px] p-[16px]">
                  <div className="ph h-[48px] w-[48px] flex-shrink-0 rounded-(--radius-pad)" style={{ background: 'var(--ph-bg)' }} />
                  <div className="flex-1">
                    <div className="font-bold">{p.titleAr}</div>
                    <div className="text-[11.5px] text-muted-2">{p.creator}</div>
                  </div>
                  <button
                    className="rounded-(--radius-sm) border px-[12px] py-[6px] text-[12px] font-semibold"
                    style={{
                      background: partnered ? 'rgba(var(--purple-rgb),0.13)' : 'rgba(var(--ink-rgb),0.06)',
                      borderColor: partnered ? 'rgba(var(--purple-rgb),0.47)' : 'transparent',
                      color: partnered ? 'var(--purple)' : 'var(--muted)',
                    }}
                  >
                    {partnered ? 'بشراكة وثبة ✓' : 'تعيين كشريك'}
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
