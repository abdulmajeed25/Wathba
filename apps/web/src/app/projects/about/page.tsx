import type { Metadata } from 'next';

import { LegalSection, WathbaLegalPage } from '@/components/ventures/wathba/wathba-legal';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = {
  title: 'عن وثبة · وثبة',
  description:
    'وثبة — منصة سعودية للدعم الجماعي بضمان تنفيذ: نجمع المبدعين العرب بمجتمعٍ يدعمهم، وبنموذج ضمانٍ يحمي الداعمين.',
};

/** STAKES/H1 — the about page: who we are, the model, the trust promise. */
export default function AboutPage() {
  return (
    <WathbaShell>
      <WathbaLegalPage
        eyebrow="ABOUT · عن وثبة"
        title="عن وثبة"
        intro="وثبة منصة دعم جماعي سعودية تجمع المبدعين بمجتمعٍ يؤمن بأفكارهم — بنموذج ضمانٍ يحمي الداعم ويحفّز المبدع على التسليم."
      >
        <LegalSection
          n="1"
          title="لماذا وثبة؟"
          body="المبدع العربي يملك الفكرة ولا يجد التمويل المبكر؛ والداعم يريد أن يساهم دون أن يخاطر بأمواله في وعودٍ بلا ضمانات. وثبة تحل الطرفين معاً: تمويل جماعي بعقود واضحة، وضمان تنفيذ يُصرف على مراحل."
        />
        <LegalSection
          n="2"
          title="كيف نختلف؟"
          body={
            <>
              الأموال لا تصل المبدع دفعة واحدة: تُحتجز في <strong>حساب ضمان</strong> وتُصرف
              على <strong>مراحل تنفيذ</strong> يوثّقها المبدع ويراجعها فريقنا. فشل الحملة في
              بلوغ عتبة ٨٠٪ يعني استرداداً تلقائياً كاملاً — دون طلب.
            </>
          }
        />
        <LegalSection
          n="3"
          title="التوافق والامتثال"
          body="هوية وطنية موثقة عبر نفاذ لكل مبدع، فواتير متوافقة مع فوترة هيئة الزكاة والضريبة والجمارك (ZATCA)، وحماية بيانات وفق نظام حماية البيانات الشخصية (PDPL)."
        />
        <LegalSection
          n="4"
          title="رؤيتنا"
          body="أن تكون وثبة نقطة الانطلاق الأولى لكل مشروع إبداعي عربي — من الفكرة إلى منتَج يصل يد داعميه، بشفافية كاملة في كل خطوة، وبما يتسق مع مستهدفات رؤية السعودية 2030 في ريادة الأعمال والاقتصاد الإبداعي."
        />
        <LegalSection
          n="5"
          title="تواصل معنا"
          body={
            <>
              الدعم: <a href="mailto:support@wathba.sa" style={{ color: 'var(--accent-ink, #04773a)' }}>support@wathba.sa</a> — أو من
              مركز المساعدة داخل المنصة. للشراكات والإعلام: partners@wathba.sa.
            </>
          }
        />
      </WathbaLegalPage>
    </WathbaShell>
  );
}
