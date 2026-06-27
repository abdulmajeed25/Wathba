'use client';

import { use as useUnwrap } from 'react';
import Link from 'next/link';
import { ArrowRight, CloudUpload, CheckCircle2, Clock } from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { ButtonLink } from '@/components/Button';
import { trendingProjects } from '@/data/mock';

interface MilestoneRow {
  id: string;
  order: number;
  titleAr: string;
  releasePct: number;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'RELEASED';
  amountHalalas: number;
}

const SAMPLE: MilestoneRow[] = [
  { id: 'm1', order: 1, titleAr: 'إنهاء النموذج الأوّلي',       releasePct: 25, status: 'RELEASED', amountHalalas: 641_687_500 },
  { id: 'm2', order: 2, titleAr: 'بدء التصنيع التجريبي',        releasePct: 30, status: 'APPROVED', amountHalalas: 770_025_000 },
  { id: 'm3', order: 3, titleAr: 'الدفعة الأولى من الشحن',       releasePct: 25, status: 'SUBMITTED', amountHalalas: 641_687_500 },
  { id: 'm4', order: 4, titleAr: 'إكمال التسليم لكل الداعمين', releasePct: 20, status: 'PENDING',   amountHalalas: 513_350_000 },
];

const STATUS_LABEL: Record<MilestoneRow['status'], string> = {
  PENDING: 'لم تبدأ', SUBMITTED: 'قُدِّمت الأدلة', APPROVED: 'مُعتمدة', RELEASED: 'تمّ الصرف',
};
const STATUS_COLOR: Record<MilestoneRow['status'], string> = {
  PENDING: 'var(--muted2)', SUBMITTED: 'var(--gold)', APPROVED: 'var(--blue)', RELEASED: 'var(--pos)',
};

export default function MilestonesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = useUnwrap(params);
  const project = trendingProjects.find((p) => p.id === projectId);
  const totalReleased = SAMPLE.filter((m) => m.status === 'RELEASED').reduce((a, m) => a + m.amountHalalas, 0);
  const totalPlanned = SAMPLE.reduce((a, m) => a + m.amountHalalas, 0);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-card) px-[26px] pt-[40px] pb-[60px]">
        <Link href={`/projects/${projectId}`} className="navlink mb-[14px] inline-flex items-center gap-[6px] text-[13px] text-muted">
          <ArrowRight className="h-[17px] w-[17px]" />عودة
        </Link>
        <div className="num mb-[6px] text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
          CREATOR / MILESTONES
        </div>
        <h1 className="mb-[6px] text-[32px] font-bold tracking-[-0.6px]">مراحل المشروع</h1>
        <p className="mb-[24px] text-[14px] text-muted">{project?.titleAr ?? '—'}</p>

        <Card radius="cardLg" className="mb-[18px] p-[20px]">
          <div className="mb-[12px] flex items-baseline justify-between">
            <h2 className="text-[18px] font-bold">مبلغ مفرَج عنه</h2>
            <span className="num text-[22px] font-bold" style={{ color: 'var(--accent)' }}>
              {(totalReleased / 100).toLocaleString('en-US')} ر.س
            </span>
          </div>
          <ProgressBar pct={totalReleased / totalPlanned} height={9} />
          <p className="num mt-[8px] text-[11.5px] text-muted-2">
            من إجمالي {(totalPlanned / 100).toLocaleString('en-US')} ر.س على{' '}
            {toArabicDigits(SAMPLE.length)} مراحل
          </p>
        </Card>

        <div className="space-y-[14px]">
          {SAMPLE.map((m) => (
            <Card key={m.id} radius="cardLg" className="p-[20px]">
              <div className="flex items-start gap-[14px]">
                <div
                  className="grid h-[38px] w-[38px] place-items-center rounded-(--radius-pad)"
                  style={{ background: STATUS_COLOR[m.status] + '22' }}
                >
                  <span className="num font-bold" style={{ color: STATUS_COLOR[m.status] }}>
                    {toArabicDigits(m.order)}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="mb-[4px] flex items-center gap-[8px]">
                    <h3 className="flex-1 text-[18px] font-bold">{m.titleAr}</h3>
                    <span
                      className="rounded-(--radius-pill) px-[10px] py-[3px] text-[11px] font-bold"
                      style={{ background: STATUS_COLOR[m.status] + '18', color: STATUS_COLOR[m.status] }}
                    >
                      {STATUS_LABEL[m.status]}
                    </span>
                  </div>
                  <div className="num text-[11.5px] text-muted-2">
                    {toArabicDigits(m.releasePct)}% من التمويل ·{' '}
                    {(m.amountHalalas / 100).toLocaleString('en-US')} ر.س
                  </div>
                  {m.status === 'PENDING' && (
                    <ButtonLink href="#" size="sm" className="mt-[12px]">
                      <CloudUpload className="h-[18px] w-[18px]" /> رفع الأدلة
                    </ButtonLink>
                  )}
                  {m.status === 'APPROVED' && (
                    <div className="mt-[8px] inline-flex items-center gap-[6px] text-[13px]" style={{ color: 'var(--pos)' }}>
                      <CheckCircle2 className="h-[16px] w-[16px]" />
                      جاهزة للصرف — سيتم التحويل تلقائياً خلال ٤٨ ساعة
                    </div>
                  )}
                  {m.status === 'SUBMITTED' && (
                    <div className="mt-[8px] inline-flex items-center gap-[6px] text-[13px]" style={{ color: 'var(--gold)' }}>
                      <Clock className="h-[16px] w-[16px]" />
                      تنتظر مراجعة الإدارة
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
