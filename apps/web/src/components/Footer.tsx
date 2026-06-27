import Link from 'next/link';
import { Rocket, Twitter, Linkedin, Instagram, Youtube } from 'lucide-react';

const COLS = [
  {
    title: 'وثبة',
    items: [
      { label: 'عن المنصة', href: '/how' },
      { label: 'كيف نعمل',  href: '/how' },
      { label: 'رتب الداعمين', href: '/ranks' },
      { label: 'مدوّنة الشفافية', href: '/how' },
    ],
  },
  {
    title: 'للمبدعين',
    items: [
      { label: 'أطلق مشروعك', href: '/launch' },
      { label: 'دليل المبدع', href: '/how' },
      { label: 'الرسوم والعمولة', href: '/how' },
      { label: 'الأسئلة الشائعة', href: '/help' },
    ],
  },
  {
    title: 'القانوني',
    items: [
      { label: 'الشروط والأحكام', href: '/legal/terms' },
      { label: 'سياسة الخصوصية', href: '/legal/privacy' },
      { label: 'شروط العقود', href: '/legal/contracts' },
      { label: 'تواصل معنا', href: '/help' },
    ],
  },
];

export function Footer() {
  return (
    <footer
      className="mt-[90px] border-t"
      style={{ borderColor: 'rgba(var(--ink-rgb),0.07)', background: 'var(--footer)' }}
    >
      <div className="mx-auto grid max-w-(--container-app) gap-[34px] px-[26px] pt-[54px] pb-[30px] md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-[16px] flex items-center gap-[11px]">
            <div
              className="grid h-[38px] w-[38px] place-items-center rounded-(--radius-pad)"
              style={{ background: 'var(--grad)', color: 'var(--on-accent)' }}
            >
              <Rocket strokeWidth={2.4} className="h-[22px] w-[22px]" />
            </div>
            <div className="text-[18px] font-bold">وثبة</div>
          </div>
          <p className="max-w-[280px] text-[14px] leading-[1.7] text-muted-2">
            منصة الدعم الجماعي التي تجمع المبدعين بمجتمعٍ يؤمن بأفكارهم — بشفافية وثقة.
          </p>
          <div className="mt-[20px] flex gap-[10px]">
            {[Twitter, Linkedin, Instagram, Youtube].map((I, i) => (
              <div
                key={i}
                className="btng grid h-[38px] w-[38px] place-items-center rounded-(--radius-lg) border"
                style={{ borderColor: 'rgba(var(--ink-rgb),0.1)' }}
              >
                <I className="h-[19px] w-[19px] text-muted" />
              </div>
            ))}
          </div>
        </div>

        {COLS.map((c) => (
          <div key={c.title}>
            <div className="mb-[16px] text-[13px] font-bold text-text-soft">{c.title}</div>
            {c.items.map((it) => (
              <Link
                key={it.label}
                href={it.href}
                className="navlink mb-[12px] block w-fit cursor-pointer text-[13.5px] text-muted-2"
              >
                {it.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div
        className="mx-auto flex max-w-(--container-app) flex-wrap items-center justify-between gap-[12px] border-t px-[26px] py-[20px]"
        style={{ borderColor: 'rgba(var(--ink-rgb),0.06)' }}
      >
        <span className="num text-[12.5px] text-muted-2">
          © 2026 وثبة — WATHBA. جميع الحقوق محفوظة.
        </span>
        <span className="text-[12.5px] text-muted-2">صُمّم بشغف للمبدعين العرب</span>
      </div>
    </footer>
  );
}
