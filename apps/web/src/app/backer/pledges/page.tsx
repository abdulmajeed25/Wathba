import Link from 'next/link';
import { Lock, CheckCircle2, Undo2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';

interface MyPledge {
  id: string; projectId: string; projectTitleAr: string; tierTitle: string;
  amountHalalas: number; status: 'HELD' | 'CAPTURED' | 'REFUNDED'; date: string;
}

const STATUS = {
  HELD:     { label: 'محجوز (ينتظر النجاح)', tone: 'gold' as const,    icon: Lock },
  CAPTURED: { label: 'تمّ الخصم',             tone: 'pos' as const,     icon: CheckCircle2 },
  REFUNDED: { label: 'مسترَد',                tone: 'muted' as const,   icon: Undo2 },
};

const MOCK: MyPledge[] = [
  { id: 'pl1', projectId: 'sirb',   projectTitleAr: 'سِرب — درون التصوير الذكي', tierTitle: 'الإصدار المبكر',  amountHalalas: 75_000,  status: 'HELD',     date: '٢٠٢٦/٠٦/٢٠' },
  { id: 'pl2', projectId: 'hekaya', projectTitleAr: 'حكايا — قصص الأطفال',       tierTitle: 'الداعم الذهبي',   amountHalalas: 250_000, status: 'CAPTURED', date: '٢٠٢٦/٠٥/٠٤' },
  { id: 'pl3', projectId: 'tarib',  projectTitleAr: 'طرَب — لعبة لوحية',         tierTitle: 'النسخة الكاملة', amountHalalas: 35_000,  status: 'REFUNDED', date: '٢٠٢٦/٠٤/١٢' },
];

export default function MyPledgesPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-card) px-[26px] pt-[40px] pb-[60px]">
        <div className="num mb-[6px] text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
          MY PLEDGES
        </div>
        <h1 className="mb-[6px] text-[32px] font-bold tracking-[-0.6px]">دعومي</h1>
        <p className="mb-[26px] text-[14px] text-muted">
          تتبّع كل المشاريع التي دعمتها وحالتها الحالية.
        </p>

        <div className="space-y-[14px]">
          {MOCK.map((p) => {
            const s = STATUS[p.status];
            return (
              <Link key={p.id} href={`/backer/pledges/${p.id}`} className="block">
                <Card radius="cardLg" lift className="p-[18px]">
                  <div className="flex gap-[12px]">
                    <div className="ph h-[60px] w-[60px] flex-shrink-0 rounded-(--radius-btn)" style={{ background: 'var(--ph-bg)' }} />
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-[4px] truncate text-[16px] font-bold">{p.projectTitleAr}</h3>
                      <p className="mb-[8px] text-[11.5px] text-muted-2">
                        {p.tierTitle} · {p.date}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="num text-[15px] font-bold" style={{ color: 'var(--accent)' }}>
                          {(p.amountHalalas / 100).toLocaleString('en-US')} ر.س
                        </span>
                        <Pill tone={s.tone} size="sm">{s.label}</Pill>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
      <Footer />
    </>
  );
}
