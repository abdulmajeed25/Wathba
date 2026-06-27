import { HeartHandshake, Rocket, ShieldCheck, Gavel, HelpCircle, Mail, Phone } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';

const TOPICS = [
  { icon: HeartHandshake, title: 'دعم مشروع',          desc: 'كيف أدعم؟ كيف أُلغي؟ متى يُخصم المبلغ؟' },
  { icon: Rocket,         title: 'إطلاق مشروع',          desc: 'الإعداد، التمويل، المراحل، الصرف.' },
  { icon: ShieldCheck,    title: 'الأمان والتحقق',       desc: 'نفاذ، حماية البيانات، حذف الحساب.' },
  { icon: Gavel,          title: 'العقود والقانوني',     desc: 'أنواع العقود، الشروط، السياسات.' },
];

const FAQS = [
  { q: 'متى سأستلم مكافأتي؟', a: 'بعد إغلاق الحملة بـ٢-٤ أشهر — كل رتبة مكافأة تحمل موعد التسليم المتوقع.' },
  { q: 'ماذا يحدث إن لم يصل المشروع لهدفه؟', a: 'يُعاد كامل المبلغ المحجوز إلى بطاقتك تلقائياً، ولن يتمّ خصم أي جزء منه.' },
  { q: 'كيف أعرف كيف صُرفت أموالي؟', a: 'لوحة الشفافية الحيّة في صفحة المشروع تُحدَّث مع كل مرحلة، وتعرض توزيع الميزانية والإنفاق التفصيلي.' },
  { q: 'هل يمكنني إلغاء دعمي؟', a: 'نعم، يمكنك إلغاء دعمك أي وقت قبل إغلاق الحملة من «دعومي» في ملفك الشخصي.' },
];

export default function HelpPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[820px] px-[26px] pt-[40px] pb-[60px]">
        <h1 className="mb-[8px] text-[32px] font-bold tracking-[-0.6px]">مركز المساعدة</h1>
        <p className="mb-[26px] text-[14px] text-muted">اعثر على إجاباتك أو تواصل معنا مباشرة.</p>

        <h2 className="num mb-[10px] text-[12px] font-bold tracking-[1px] text-muted-2">المواضيع</h2>
        <div className="mb-[22px] grid gap-[10px] md:grid-cols-2">
          {TOPICS.map((t) => (
            <Card key={t.title} radius="cardLg" lift className="flex items-center gap-[12px] p-[16px]">
              <div
                className="grid h-[44px] w-[44px] place-items-center rounded-(--radius-pad)"
                style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}
              >
                <t.icon className="h-[22px] w-[22px]" />
              </div>
              <div>
                <div className="font-bold">{t.title}</div>
                <div className="text-[11.5px] text-muted-2">{t.desc}</div>
              </div>
            </Card>
          ))}
        </div>

        <h2 className="num mb-[10px] text-[12px] font-bold tracking-[1px] text-muted-2">أسئلة شائعة</h2>
        <div className="mb-[22px] space-y-[10px]">
          {FAQS.map((f) => (
            <Card key={f.q} radius="card" className="p-[20px]">
              <div className="mb-[8px] flex items-center gap-[10px]">
                <HelpCircle className="h-[20px] w-[20px]" style={{ color: 'var(--accent)' }} />
                <h3 className="text-[16px] font-bold">{f.q}</h3>
              </div>
              <p className="ps-[30px] text-[14px] leading-[1.7] text-muted">{f.a}</p>
            </Card>
          ))}
        </div>

        <Card radius="cardLg" className="p-[20px]">
          <h2 className="mb-[12px] text-[18px] font-bold">تواصل معنا</h2>
          <a
            href="mailto:support@wathba.sa"
            className="flex items-center gap-[10px] py-[12px] hover:text-accent"
          >
            <Mail className="h-[22px] w-[22px]" style={{ color: 'var(--accent)' }} />
            <span className="flex-1">support@wathba.sa</span>
          </a>
          <a
            href="tel:+966112222222"
            className="flex items-center gap-[10px] border-t py-[12px] hover:text-accent"
            style={{ borderColor: 'rgba(var(--ink-rgb),0.05)' }}
          >
            <Phone className="h-[22px] w-[22px]" style={{ color: 'var(--accent)' }} />
            <span className="num flex-1">+٩٦٦ ١١ ٢٢٢ ٢٢٢٢</span>
          </a>
        </Card>
      </main>
      <Footer />
    </>
  );
}
