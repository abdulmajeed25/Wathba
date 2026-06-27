import Link from 'next/link';
import { CreditCard, Lock, ShoppingBag, Undo2, PiggyBank, PlusCircle, Wallet } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';

const METHODS = [
  { id: 'c1', label: '•••• ٤٢٤٢', kind: 'بطاقة Visa', default: true },
  { id: 'c2', label: '•••• ٧٧٢١', kind: 'بطاقة Mada', default: false },
];

const TXS = [
  { id: 't1', kind: 'pledge_held',     title: 'دعم «سِرب»',           date: '٢٠٢٦/٠٦/٢٠', amount: -750 },
  { id: 't2', kind: 'pledge_captured', title: 'خصم دعم «حكايا»',      date: '٢٠٢٦/٠٥/٠٤', amount: -2500 },
  { id: 't3', kind: 'pledge_refunded', title: 'استرداد دعم «طرَب»',   date: '٢٠٢٦/٠٤/١٢', amount: 350 },
  { id: 't4', kind: 'payout_received', title: 'مكافأة الإحالة',       date: '٢٠٢٦/٠٣/٠١', amount: 50 },
];

const KIND_LABEL: Record<string, string> = {
  pledge_held: 'حجز', pledge_captured: 'خصم', pledge_refunded: 'استرداد', payout_received: 'دفعة واردة',
};
const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pledge_held: Lock, pledge_captured: ShoppingBag, pledge_refunded: Undo2, payout_received: PiggyBank,
};

export default function PaymentsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-card) px-[26px] pt-[40px] pb-[60px]">
        <div className="num mb-[6px] text-[12px] tracking-[2px]" style={{ color: 'var(--accent)' }}>
          PAYMENTS
        </div>
        <h1 className="mb-[6px] text-[32px] font-bold tracking-[-0.6px]">الدفع والمعاملات</h1>
        <p className="mb-[26px] text-[14px] text-muted">طرق الدفع المحفوظة + سجل كامل بالمعاملات.</p>

        <h2 className="mb-[10px] text-[12px] font-bold tracking-[1px] text-muted-2 num">طرق الدفع</h2>
        <div className="mb-[22px] space-y-[10px]">
          {METHODS.map((m) => (
            <Card key={m.id} radius="cardLg" className="flex items-center gap-[12px] p-[18px]">
              <div
                className="grid h-[44px] w-[44px] place-items-center rounded-(--radius-pad)"
                style={{ background: 'rgba(var(--ink-rgb),0.05)' }}
              >
                <CreditCard className="h-[22px] w-[22px] text-muted" />
              </div>
              <div className="flex-1">
                <div className="num font-bold">{m.label}</div>
                <div className="text-[11.5px] text-muted-2">{m.kind}</div>
              </div>
              {m.default && <Pill tone="accent">افتراضية</Pill>}
            </Card>
          ))}
          <button
            className="btng flex w-full items-center justify-center gap-[8px] rounded-(--radius-btn) border border-dashed p-[14px] text-[14px] font-semibold"
            style={{ borderColor: 'rgba(var(--accent-rgb),0.3)', color: 'var(--accent)' }}
          >
            <PlusCircle className="h-[20px] w-[20px]" /> إضافة بطاقة جديدة
          </button>
        </div>

        <h2 className="mb-[10px] text-[12px] font-bold tracking-[1px] text-muted-2 num">سجل المعاملات</h2>
        <Card radius="cardLg" className="overflow-hidden p-0">
          {TXS.map((t, i) => {
            const Icon = KIND_ICON[t.kind]!;
            const positive = t.amount > 0;
            return (
              <div
                key={t.id}
                className="flex items-center gap-[12px] border-b px-[18px] py-[14px] last:border-b-0"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.04)' }}
              >
                <div
                  className="grid h-[38px] w-[38px] place-items-center rounded-(--radius-lg)"
                  style={{ background: positive ? 'rgba(5,166,97,0.12)' : 'rgba(var(--ink-rgb),0.06)', color: positive ? 'var(--pos)' : 'var(--muted)' }}
                >
                  <Icon className="h-[20px] w-[20px]" />
                </div>
                <div className="flex-1">
                  <div className="text-[14px] font-semibold">{t.title}</div>
                  <div className="num text-[11.5px] text-muted-2">{KIND_LABEL[t.kind]} · {t.date}</div>
                </div>
                <span
                  className="num text-[15px] font-bold"
                  style={{ color: positive ? 'var(--pos)' : 'var(--text)' }}
                >
                  {positive ? '+' : '−'}{Math.abs(t.amount).toLocaleString('en-US')} ر.س
                </span>
                {i === -1 && <span />}
              </div>
            );
          })}
        </Card>

        <Link href="/wallet" className="mt-[16px] block">
          <Card radius="cardLg" className="flex items-center gap-[12px] p-[18px]">
            <Wallet className="h-[22px] w-[22px]" style={{ color: 'var(--accent)' }} />
            <span className="flex-1 font-semibold">محفظتي (للمبدعين)</span>
            <span className="text-muted-2">←</span>
          </Card>
        </Link>
      </main>
      <Footer />
    </>
  );
}
