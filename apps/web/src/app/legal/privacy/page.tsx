import { ShieldCheck } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Pill } from '@/components/Pill';

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[760px] px-[26px] pt-[40px] pb-[60px]">
        <Pill tone="accent" className="mb-[18px]">
          <ShieldCheck className="h-[14px] w-[14px]" /> نظام حماية البيانات الشخصية · سدايا
        </Pill>
        <h1 className="mb-[12px] text-[32px] font-bold">سياسة الخصوصية</h1>
        <p className="mb-[28px] text-[13px] text-muted-2">متوافقة مع نظام حماية البيانات الشخصية (PDPL)</p>

        <Section title="١. ما البيانات التي نجمعها؟">
          الاسم، البريد، رقم الجوال، بيانات الهوية الوطنية عند التحقق من نفاذ، عناوين الشحن
          للمكافآت المادية، ومعلومات تقنية كنوع الجهاز وعنوان IP.
        </Section>
        <Section title="٢. لماذا نجمعها؟">
          • لتقديم خدمات المنصة (دعم، تمويل، شحن، شفافية).
          {'\n'}• للالتزام بمتطلبات الجهات التنظيمية (KYC, AML, ZATCA).
          {'\n'}• لتحسين تجربة الاستخدام والأمان.
        </Section>
        <Section title="٣. أين تُخزَّن البيانات؟">
          داخل المملكة العربية السعودية، على بنية تحتية موثوقة ومُؤمَّنة.
        </Section>
        <Section title="٤. حقوقك">
          • الاطلاع على بياناتك.
          {'\n'}• تصحيحها أو تحديثها.
          {'\n'}• طلب حذفها — مع مراعاة المتطلبات النظامية.
          {'\n'}• نقلها لمزوّد آخر.
          {'\n'}• تقديم شكوى للسلطة المختصة (سدايا).
        </Section>
        <Section title="٥. التواصل">
          لأي استفسار بخصوص بياناتك تواصل معنا على privacy@wathba.sa.
        </Section>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-[24px]">
      <h2 className="mb-[10px] text-[20px] font-bold">{title}</h2>
      <p className="text-[16px] leading-[1.85] whitespace-pre-line text-text-soft">{children}</p>
    </section>
  );
}
