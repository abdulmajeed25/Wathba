'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, PartyPopper, XCircle, CircleCheckBig, DollarSign, Megaphone, Award } from 'lucide-react';
import { toArabicDigits } from '@wathba/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';

interface Noti {
  id: string;
  kind: 'PLEDGE_RECEIVED' | 'PROJECT_FUNDED' | 'PROJECT_FAILED' | 'MILESTONE_APPROVED' | 'PAYOUT_SENT' | 'UPDATE_POSTED' | 'RANK_UP';
  title: string;
  body: string;
  time: string;
  unread: boolean;
  href?: string;
}

const ICON_FOR: Record<Noti['kind'], React.ComponentType<{ className?: string; fill?: string }>> = {
  PLEDGE_RECEIVED: Heart, PROJECT_FUNDED: PartyPopper, PROJECT_FAILED: XCircle,
  MILESTONE_APPROVED: CircleCheckBig, PAYOUT_SENT: DollarSign, UPDATE_POSTED: Megaphone, RANK_UP: Award,
};
const COLOR_FOR: Record<Noti['kind'], string> = {
  PROJECT_FUNDED: 'var(--pos)', PAYOUT_SENT: 'var(--pos)',
  RANK_UP: 'var(--gold)', MILESTONE_APPROVED: 'var(--gold)',
  PROJECT_FAILED: '#ef4444',
  PLEDGE_RECEIVED: 'var(--accent)', UPDATE_POSTED: 'var(--accent)',
};

const MOCK: Noti[] = [
  { id: 'n1', kind: 'PROJECT_FUNDED',     title: 'حكايا وصل ١٠٠٪ من هدفه! 🎉', body: 'المشروع نجح وبدأ التصنيع — متابعتك مهمة.', time: 'قبل ١٠ دقائق', unread: true,  href: '/projects/hekaya' },
  { id: 'n2', kind: 'UPDATE_POSTED',      title: 'تحديث جديد على «سِرب»',        body: 'فريق سِرب نشر التحديث #٤ — وصول الدفعة الأولى من المصنع.', time: 'قبل ساعة',      unread: true,  href: '/projects/sirb' },
  { id: 'n3', kind: 'RANK_UP',            title: 'ارتقيت إلى رتبة سفير',        body: 'مزايا جديدة فُتحت لك — تفقّدها من «الرتب».',          time: 'قبل يومين',    unread: true,  href: '/ranks' },
  { id: 'n4', kind: 'PLEDGE_RECEIVED',    title: 'تأكيد دعمك لـ «سِرب»',         body: 'دعمك ٧٥٠ ر.س محجوز بأمان حتى تاريخ ٠٢ يوليو.',          time: 'قبل ٣ أيام',  unread: false, href: '/backer/pledges' },
  { id: 'n5', kind: 'PAYOUT_SENT',        title: 'تم صرف الدفعة الأولى',        body: '٦٤٠,٠٠٠ ر.س حُوّلت لحسابك من مشروع سِرب.',                time: 'الأسبوع الماضي', unread: false },
];

export default function NotificationsPage() {
  const [items, setItems] = useState(MOCK);
  const unread = items.filter((n) => n.unread).length;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-card) px-[26px] pt-[40px] pb-[60px]">
        <div className="mb-[20px] flex items-center justify-between">
          <div>
            <h1 className="text-[26px] font-bold">الإشعارات</h1>
            {unread > 0 && (
              <p className="num mt-[4px] text-[13px] text-muted">
                {toArabicDigits(unread)} غير مقروء
              </p>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={() => setItems((arr) => arr.map((n) => ({ ...n, unread: false })))}
              className="btng rounded-(--radius-md) border px-[14px] py-[7px] text-[13px] text-muted"
              style={{ borderColor: 'rgba(var(--ink-rgb),0.16)' }}
            >
              تمييز الكل كمقروء
            </button>
          )}
        </div>

        <div className="space-y-[10px]">
          {items.map((n) => {
            const Icon = ICON_FOR[n.kind];
            const color = COLOR_FOR[n.kind];
            return (
              <Link
                key={n.id}
                href={n.href ?? '#'}
                onClick={() => setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))}
                className="block"
              >
                <Card
                  radius="cardLg"
                  className="flex gap-[12px] p-[16px]"
                  {...{
                    style: {
                      background: n.unread ? 'rgba(var(--accent-rgb),0.04)' : 'var(--card)',
                      borderColor: n.unread ? 'rgba(var(--accent-rgb),0.25)' : 'rgba(var(--ink-rgb),0.09)',
                    },
                  }}
                >
                  <div
                    className="grid h-[44px] w-[44px] flex-shrink-0 place-items-center rounded-(--radius-pad)"
                    style={{ background: color + '22', color }}
                  >
                    <Icon className="h-[22px] w-[22px]" fill={n.kind === 'RANK_UP' || n.kind === 'PLEDGE_RECEIVED' ? 'currentColor' : 'none'} />
                  </div>
                  <div className="flex-1">
                    <div className="mb-[4px] flex items-center gap-[6px]">
                      <h3 className="flex-1 font-bold">{n.title}</h3>
                      {n.unread && <span className="h-[8px] w-[8px] rounded-full" style={{ background: 'var(--accent)' }} />}
                    </div>
                    <p className="text-[13px] leading-[1.5] text-muted">{n.body}</p>
                    <p className="num mt-[6px] text-[11.5px] text-muted-2">{n.time}</p>
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
