import { CircleCheck, Hourglass } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Button } from '@/components/Button';

const PAYOUTS = [
  { id: 'po1', project: 'سِرب', milestone: '#١ النموذج الأوّلي',     amountHalalas: 641_687_500, status: 'SENT'    as const, date: '٢٠٢٦/٠٥/١٢' },
  { id: 'po2', project: 'سِرب', milestone: '#٢ التصنيع التجريبي',    amountHalalas: 770_025_000, status: 'PENDING' as const, date: 'قيد الإصدار' },
  { id: 'po3', project: 'حكايا', milestone: '#١ المسوّدة',           amountHalalas: 175_100_000, status: 'SENT'    as const, date: '٢٠٢٦/٠٤/٢٢' },
];

export default function WalletPage() {
  const totalSent = PAYOUTS.filter((p) => p.status === 'SENT').reduce((a, p) => a + p.amountHalalas, 0);
  const totalPending = PAYOUTS.filter((p) => p.status === 'PENDING').reduce((a, p) => a + p.amountHalalas, 0);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-card) px-[26px] pt-[40px] pb-[60px]">
        <div className="num mb-[6px] text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
          CREATOR WALLET
        </div>
        <h1 className="mb-[6px] text-[32px] font-bold tracking-[-0.6px]">محفظتي</h1>
        <p className="mb-[26px] text-[14px] text-muted">كل المبالغ التي صُرفت لك من إنجازات مشاريعك.</p>

        <div
          className="mb-[24px] overflow-hidden rounded-(--radius-card-hero) p-[28px]"
          style={{ background: 'var(--grad)' }}
        >
          <div className="text-[13px] font-semibold opacity-90" style={{ color: 'var(--on-accent)' }}>
            إجمالي المبالغ المصروفة
          </div>
          <div className="num mt-[6px] text-[38px] font-bold" style={{ color: 'var(--on-accent)' }}>
            {(totalSent / 100).toLocaleString('en-US')} ر.س
          </div>
          <div className="mt-[18px] flex items-center justify-between">
            <div>
              <div className="text-[11px] opacity-85" style={{ color: 'var(--on-accent)' }}>قيد الصرف</div>
              <div className="num text-[16px] font-semibold" style={{ color: 'var(--on-accent)' }}>
                {(totalPending / 100).toLocaleString('en-US')} ر.س
              </div>
            </div>
            <Button size="sm" variant="outline" style={{ borderColor: 'rgba(6,18,31,0.4)', color: 'var(--on-accent)' }}>
              سحب
            </Button>
          </div>
        </div>

        <h2 className="mb-[10px] text-[12px] font-bold tracking-[1px] text-muted-2 num">الدفعات</h2>
        <div className="space-y-[10px]">
          {PAYOUTS.map((p) => (
            <Card key={p.id} radius="cardLg" className="p-[18px]">
              <div className="mb-[8px] flex items-center gap-[12px]">
                <div
                  className="grid h-[40px] w-[40px] place-items-center rounded-(--radius-pad)"
                  style={{
                    background: p.status === 'SENT' ? 'rgba(5,166,97,0.12)' : 'rgba(251,191,36,0.18)',
                    color: p.status === 'SENT' ? 'var(--pos)' : 'var(--gold)',
                  }}
                >
                  {p.status === 'SENT' ? <CircleCheck className="h-[20px] w-[20px]" /> : <Hourglass className="h-[20px] w-[20px]" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{p.project}</div>
                  <div className="text-[11.5px] text-muted-2">{p.milestone}</div>
                </div>
                <Pill tone={p.status === 'SENT' ? 'pos' : 'gold'}>
                  {p.status === 'SENT' ? 'مصروفة' : 'قيد المعالجة'}
                </Pill>
              </div>
              <div
                className="flex items-center justify-between border-t pt-[10px]"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.07)' }}
              >
                <span className="num text-[13px] text-muted">{p.date}</span>
                <span className="num text-[17px] font-bold" style={{ color: 'var(--accent)' }}>
                  {(p.amountHalalas / 100).toLocaleString('en-US')} ر.س
                </span>
              </div>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
