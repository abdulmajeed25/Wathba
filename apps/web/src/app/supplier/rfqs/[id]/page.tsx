'use client';

import { use as useUnwrap, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Send, CheckCircle2, Hammer } from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { RFQS } from '@/data/procurement';

export default function RFQDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = useUnwrap(params);
  const [amount, setAmount] = useState('');
  const [lead, setLead] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const rfq = RFQS.find((r) => r.id === id);
  if (!rfq) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-(--container-card) p-[26px]">RFQ غير موجود.</main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-card) px-[26px] pt-[40px] pb-[60px]">
        <Link href="/supplier" className="navlink mb-[14px] inline-flex items-center gap-[6px] text-[13px] text-muted">
          <ArrowRight className="h-[17px] w-[17px]" />عودة للفرص
        </Link>
        <Pill tone="accent" className="mb-[14px]"><Hammer className="h-[14px] w-[14px]" /> {rfq.category}</Pill>
        <h1 className="mb-[6px] text-[26px] font-bold">{rfq.projectTitleAr}</h1>
        <p className="num mb-[18px] text-[13px] text-muted-2">
          ينتهي خلال {toArabicDigits(rfq.daysLeft)} يوم · {rfq.dueDate}
        </p>

        <Card radius="cardLg" className="mb-[18px] p-[22px]">
          <h2 className="mb-[8px] text-[18px] font-bold">المواصفات</h2>
          <p className="text-[15px] leading-[1.65] text-text-soft">{rfq.specsAr}</p>
        </Card>

        <Card radius="cardLg" className="p-[22px]">
          <h2 className="mb-[4px] text-[18px] font-bold">قدّم عرضك</h2>
          <p className="mb-[18px] text-[13px] text-muted-2">
            المنصة عرض عكسي — أفضل عرض من حيث السعر والمدة يفوز.
          </p>
          {!submitted ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
            >
              <Field label="السعر الإجمالي (ر.س)" value={amount} onChange={setAmount} placeholder="١٩٢,٥٠٠" num type="number" />
              <Field label="مدة التسليم (يوم)" value={lead} onChange={setLead} placeholder="٤٥" num type="number" />
              <div className="mb-[14px]">
                <label className="mb-[8px] block text-[13.5px] font-semibold text-text-soft">
                  ملاحظات الالتزام بالمواصفات
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="اشرح كيف تلبّي المواصفات + ضمانات الجودة + شروط الدفع."
                  className="w-full resize-y rounded-(--radius-pad) border p-[14px] text-[14px] leading-[1.6]"
                  style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
                />
              </div>
              <button
                type="submit"
                disabled={!amount || !lead || note.length < 10}
                className="btnp w-full rounded-(--radius-btn) py-[15px] text-[16px] font-bold text-on-accent disabled:opacity-60"
                style={{ background: 'var(--grad)' }}
              >
                <Send className="me-[8px] inline h-[18px] w-[18px]" /> إرسال العرض
              </button>
            </form>
          ) : (
            <div className="py-[16px] text-center">
              <CheckCircle2 className="mx-auto h-[50px] w-[50px]" style={{ color: 'var(--pos)' }} />
              <h3 className="mt-[12px] text-[20px] font-bold">تم استلام عرضك</h3>
              <p className="mt-[6px] text-[14px] text-muted">
                سيقوم صاحب المشروع بمراجعة كل العروض وإبلاغك بالقرار في «عروضي».
              </p>
            </div>
          )}
        </Card>
      </main>
      <Footer />
    </>
  );
}

function Field(props: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; num?: boolean; type?: string }) {
  return (
    <div className="mb-[14px]">
      <label className="mb-[8px] block text-[13.5px] font-semibold text-text-soft">{props.label}</label>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={props.num ? 'num w-full rounded-(--radius-pad) border p-[14px] text-[15px]' : 'w-full rounded-(--radius-pad) border p-[14px] text-[15px]'}
        style={{ background: 'rgba(var(--ink-rgb),0.04)', borderColor: 'rgba(var(--ink-rgb),0.12)' }}
      />
    </div>
  );
}
