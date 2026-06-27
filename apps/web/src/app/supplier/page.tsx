'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Hammer, Briefcase, Gavel } from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { RFQS, MY_BIDS, type BidItem } from '@/data/procurement';

const TABS = [
  { id: 'open', label: 'فرص مفتوحة' },
  { id: 'bids', label: 'عروضي' },
] as const;

const BID_STATUS_LABEL: Record<BidItem['status'], string> = {
  SUBMITTED: 'قيد المراجعة', SHORTLISTED: 'مرشّح', AWARDED: 'فائز', REJECTED: 'مرفوض',
};
const BID_STATUS_TONE: Record<BidItem['status'], 'muted' | 'gold' | 'pos' | 'partner'> = {
  SUBMITTED: 'muted', SHORTLISTED: 'gold', AWARDED: 'pos', REJECTED: 'partner',
};

export default function SupplierPortal() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('open');

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-app) px-[26px] pt-[40px] pb-[60px]">
        <div className="num mb-[6px] text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
          SUPPLIER PORTAL
        </div>
        <h1 className="mb-[8px] text-[32px] font-bold tracking-[-0.6px]">بوّابة المورّدين</h1>
        <p className="mb-[26px] text-[14px] text-muted">
          تقدّم بعروضك على مشاريع وثبة. أفضل عرض من حيث السعر والمدة يفوز.
        </p>

        <div
          className="mb-[22px] inline-flex gap-[9px] rounded-(--radius-brand) border p-[5px]"
          style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.08)' }}
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="rounded-(--radius-sm) px-[15px] py-[8px] text-[13.5px] font-semibold"
                style={{
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--muted)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'open' && (
          <div className="grid gap-[14px] md:grid-cols-2">
            {RFQS.map((r) => (
              <Link key={r.id} href={`/supplier/rfqs/${r.id}`} className="block">
                <Card radius="cardLg" lift className="p-[20px]">
                  <div className="mb-[10px] flex items-center justify-between">
                    <Pill tone="accent">
                      <Hammer className="h-[14px] w-[14px]" /> {r.category}
                    </Pill>
                    <span className="num text-[11.5px] text-muted-2">
                      ينتهي خلال {toArabicDigits(r.daysLeft)} يوم
                    </span>
                  </div>
                  <h3 className="mb-[6px] text-[18px] font-bold">{r.projectTitleAr}</h3>
                  <p className="mb-[14px] text-[13px] leading-[1.6] text-muted">{r.specsAr}</p>
                  <div
                    className="flex items-center justify-between border-t pt-[12px]"
                    style={{ borderColor: 'rgba(var(--ink-rgb),0.07)' }}
                  >
                    <div className="flex items-center gap-[6px]">
                      <Gavel className="h-[16px] w-[16px] text-muted-2" />
                      <span className="num text-[13px] text-muted">
                        {toArabicDigits(r.bidsCount)} عرض حتى الآن
                      </span>
                    </div>
                    <span className="num text-[11.5px] text-muted-2">ينتهي: {r.dueDate}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {tab === 'bids' && (
          <div className="space-y-[14px]">
            {MY_BIDS.map((b) => (
              <Card key={b.id} radius="cardLg" className="p-[20px]">
                <div className="mb-[10px] flex items-center gap-[12px]">
                  <div
                    className="grid h-[38px] w-[38px] place-items-center rounded-(--radius-lg)"
                    style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--accent)' }}
                  >
                    <Briefcase className="h-[20px] w-[20px]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[16px] font-bold">{b.rfqTitle}</h3>
                    <p className="num text-[11.5px] text-muted-2">قُدِّم {b.submittedAt}</p>
                  </div>
                  <Pill tone={BID_STATUS_TONE[b.status]} size="sm">
                    {BID_STATUS_LABEL[b.status]}
                  </Pill>
                </div>
                <div
                  className="flex gap-[14px] border-t pt-[12px]"
                  style={{ borderColor: 'rgba(var(--ink-rgb),0.07)' }}
                >
                  <div className="flex-1">
                    <div className="text-[11.5px] text-muted-2">المبلغ</div>
                    <div className="num text-[15px] font-bold" style={{ color: 'var(--accent)' }}>
                      {(b.amountHalalas / 100).toLocaleString('en-US')} ر.س
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[11.5px] text-muted-2">مدة التسليم</div>
                    <div className="num text-[15px] font-bold">
                      {toArabicDigits(b.leadTimeDays)} يوم
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
