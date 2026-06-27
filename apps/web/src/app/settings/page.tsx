'use client';

import Link from 'next/link';
import { User, MapPin, Lock, Languages, CreditCard, Wallet, FileText, ShieldQuestion, Gavel, FileBadge, Bell, Mail, MessageSquare, Palette, ChevronLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { useTheme } from '@/providers/ThemeProvider';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-(--container-card) px-[26px] pt-[40px] pb-[60px]">
        <h1 className="mb-[18px] text-[32px] font-bold tracking-[-0.6px]">الإعدادات</h1>

        <Section title="المظهر">
          <div className="flex items-center gap-[12px] px-[16px] py-[14px]">
            <Palette className="h-[22px] w-[22px]" style={{ color: 'var(--accent)' }} />
            <span className="flex-1 text-[14px] font-semibold">نمط الألوان</span>
            <div className="flex gap-[8px]">
              {(['light', 'dark'] as const).map((t) => {
                const active = t === theme;
                return (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className="rounded-(--radius-sm) px-[12px] py-[6px] text-[12px] font-semibold"
                    style={{
                      background: active ? 'var(--accent)' : 'rgba(var(--ink-rgb),0.08)',
                      color: active ? 'var(--on-accent)' : 'var(--muted)',
                    }}
                  >
                    {t === 'light' ? 'فاتح' : 'داكن'}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="الحساب">
          <Row icon={User}      title="الملف الشخصي"      href="/profile" />
          <Row icon={MapPin}    title="العناوين"          href="#" />
          <Row icon={Lock}      title="الأمان وكلمة السر" href="#" />
          <Row icon={Languages} title="اللغة"             hint="العربية" />
        </Section>

        <Section title="الإشعارات">
          <Toggle icon={Bell}          title="إشعارات داخل التطبيق" defaultOn />
          <Toggle icon={Mail}          title="إشعارات بريدية"        defaultOn />
          <Toggle icon={MessageSquare} title="رسائل نصية للأمور المهمة" />
        </Section>

        <Section title="الدفع والمحفظة">
          <Row icon={CreditCard} title="طرق الدفع"           href="/payments" />
          <Row icon={Wallet}     title="محفظتي (للمبدعين)"   href="/wallet" />
          <Row icon={FileText}   title="سجل المعاملات"       href="/payments" />
        </Section>

        <Section title="المساعدة والقانوني">
          <Row icon={ShieldQuestion} title="مركز المساعدة"           href="/help" />
          <Row icon={Gavel}          title="الشروط والأحكام"          href="/legal/terms" />
          <Row icon={FileBadge}      title="سياسة الخصوصية (PDPL)"    href="/legal/privacy" />
          <Row icon={FileText}       title="شروط العقود"              href="/legal/contracts" />
        </Section>

        <Pill tone="muted" className="my-[16px]">صفحات تفصيلية تأتي مع وصول مزود الدفع الحقيقي</Pill>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-[18px]">
      <div className="num mb-[8px] text-[12px] font-bold tracking-[1px] text-muted-2">{title}</div>
      <Card radius="cardLg" className="overflow-hidden p-0">{children}</Card>
    </div>
  );
}

type IconCmp = React.ComponentType<React.SVGProps<SVGSVGElement>>;

function Row({
  icon: Icon,
  title,
  hint,
  href,
}: {
  icon: IconCmp;
  title: string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div
      className="flex items-center gap-[12px] border-b px-[16px] py-[14px] last:border-b-0"
      style={{ borderColor: 'rgba(var(--ink-rgb),0.04)' }}
    >
      <Icon className="h-[22px] w-[22px]" style={{ color: 'var(--accent)' }} />
      <span className="flex-1 text-[14px] font-semibold">{title}</span>
      {hint && <span className="text-[13px] text-muted-2">{hint}</span>}
      <ChevronLeft className="h-[20px] w-[20px] text-muted-2" />
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Toggle({
  icon: Icon,
  title,
  defaultOn,
}: {
  icon: IconCmp;
  title: string;
  defaultOn?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-[12px] border-b px-[16px] py-[12px] last:border-b-0"
      style={{ borderColor: 'rgba(var(--ink-rgb),0.04)' }}
    >
      <Icon className="h-[22px] w-[22px] text-muted" />
      <span className="flex-1 text-[14px] font-semibold">{title}</span>
      <input type="checkbox" defaultChecked={defaultOn} className="h-[20px] w-[20px] accent-(--accent)" />
    </div>
  );
}
