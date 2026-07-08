import type { Metadata } from 'next';

import { LegalSection, WathbaLegalPage } from '@/components/ventures/wathba/wathba-legal';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = {
  title: 'الأسعار والعمولة · وثبة',
  description:
    'شفافية كاملة: عمولة وثبة ورسوم معالجة الدفع — متى تُخصم، وماذا يحدث عند فشل الحملة (لا رسوم إطلاقاً).',
};

/** STAKES/H6 — fee-transparency page (trust-critical for crowdfunding). */
export default function PricingPage() {
  return (
    <WathbaShell>
      <WathbaLegalPage
        eyebrow="PRICING · الأسعار"
        title="الأسعار والعمولة"
        intro="لا رسوم اشتراك ولا رسوم إدراج — وثبة تكسب فقط عندما ينجح مشروعك. هذه كل الأرقام، بلا هوامش صغيرة."
      >
        <LegalSection
          n="1"
          title="إطلاق المشروع: مجاني"
          body="إنشاء الحساب، توثيق نفاذ، بناء صفحة الحملة، ومراجعة الفريق لها — كلها بلا مقابل. لا تدفع شيئاً قبل نجاح حملتك."
        />
        <LegalSection
          n="2"
          title="عمولة المنصة: ٥٪ من التمويل المُحصَّل"
          body={
            <>
              تُخصم <strong>مرة واحدة</strong> من إجمالي المبلغ المحصَّل عند نجاح الحملة
              (بلوغ عتبة ٨٠٪ فأكثر بحلول الموعد النهائي). لا عمولة على الحملات
              غير المكتملة.
            </>
          }
        />
        <LegalSection
          n="3"
          title="رسوم معالجة الدفع: ~٢.٩٪ + ١ ر.س لكل عملية"
          body="تُحصَّل بواسطة مزوّد الدفع (مدى/بطاقات/آبل باي) على العمليات الناجحة فقط، وتظهر مفصّلة في تقرير الصرف. عمليات الاسترداد لا يتحمّل الداعم فيها شيئاً."
        />
        <LegalSection
          n="4"
          title="فشلت الحملة؟ صفر رسوم"
          body="إن لم تبلغ الحملة عتبتها، يُعاد كامل مبلغ كل داعم تلقائياً — لا عمولة منصة، لا رسوم معالجة على الداعم، لا خصومات."
        />
        <LegalSection
          n="5"
          title="الصرف على مراحل"
          body="المبلغ الصافي (بعد العمولة والرسوم) يُصرف من حساب الضمان على دفعات مرتبطة بمراحل التنفيذ الموثقة — الجدول الكامل يظهر لك في لوحة المشروع قبل الإطلاق، وللداعمين في تبويب الشفافية."
        />
        <LegalSection
          n="6"
          title="مثال رقمي"
          body={
            <>
              حملة حصّلت <strong>100,000 ر.س</strong>: عمولة وثبة 5,000 ر.س + رسوم معالجة
              ≈ 2,900 ر.س ⇒ يصل المبدع صافي <strong>≈ 92,100 ر.س</strong> على دفعات
              مراحله. الأرقام الدقيقة لكل حملة تظهر في تقرير الصرف المفصّل.
            </>
          }
        />
      </WathbaLegalPage>
    </WathbaShell>
  );
}
