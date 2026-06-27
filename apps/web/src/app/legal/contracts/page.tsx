import { HeartHandshake, Package, PackageOpen, Lightbulb } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/Card';

/** §6 templates — mirrored 1:1 from apps/api/src/contracts/contracts.service.ts. */
const TYPES = [
  {
    id: 'DONATION',
    label: 'تبرّع (Donation)',
    icon: HeartHandshake,
    body:
      'بدعمك لهذا المشروع، أنت تساهم طوعياً في تمويله. مكافأتك (إن وُجدت) هي شكر رمزي من المبدع، وليست منتجاً مضموناً تجارياً. تُستخدم في المشاريع غير الربحية والرمزية والإبداعية.',
  },
  {
    id: 'ISTISNA',
    label: 'استصناع (Istisna)',
    icon: Package,
    body:
      'بدعمك، تطلب من المبدع صناعة المنتج وفق المواصفات المنشورة وتسليمه بحلول التاريخ المحدد. تُحتسب أموالك في حساب ضمان ولا تُحوَّل إلا عند تحقّق المشروع لشروط النجاح. متوافق مع الشريعة ومناسب للمنتجات الجديدة.',
  },
  {
    id: 'SALAM',
    label: 'سَلَم (Salam)',
    icon: PackageOpen,
    body:
      'تدفع المبلغ مقدّماً لقاء سلعة موصوفة في الذمة تُسلَّم في موعد لاحق. تُحفظ أموالك في حساب ضمان ولا تُحوَّل قبل بلوغ هدف التمويل. مناسب للمحاصيل والإنتاج المتسلسل.',
  },
];

export default function ContractsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[760px] px-[26px] pt-[40px] pb-[60px]">
        <h1 className="mb-[8px] text-[32px] font-bold">شروط عقود الدعم</h1>
        <p className="mb-[26px] text-[14px] text-muted">
          كل مشروع يُحدّد نوع العقد المناسب لطبيعته. هذه نظرة كاملة على الأنواع المتاحة.
        </p>
        <div className="space-y-[14px]">
          {TYPES.map((t) => (
            <Card key={t.id} radius="cardLg" className="p-[22px]">
              <div className="mb-[10px] flex items-center gap-[10px]">
                <t.icon className="h-[26px] w-[26px]" style={{ color: 'var(--accent)' }} />
                <h2 className="text-[20px] font-bold">{t.label}</h2>
              </div>
              <p className="text-[16px] leading-[1.85] text-text-soft">{t.body}</p>
            </Card>
          ))}
        </div>
        <div
          className="mt-[22px] flex gap-[10px] rounded-(--radius-btn) border p-[16px]"
          style={{ background: 'rgba(var(--accent-rgb),0.05)', borderColor: 'rgba(var(--accent-rgb),0.18)' }}
        >
          <Lightbulb className="h-[20px] w-[20px] flex-shrink-0" style={{ color: 'var(--accent)' }} />
          <p className="text-[14px] leading-[1.6] text-text-soft">
            هذه نسخة عامة. النسخة الملزمة هي ما يظهر في صفحة الدعم لكل مشروع بحسب نوع العقد المحدد.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
