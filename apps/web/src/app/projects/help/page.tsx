import type { Metadata } from 'next';

import {
  HelpTopicCard,
  LegalSection,
  WathbaLegalPage,
} from '@/components/ventures/wathba/wathba-legal';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'مركز المساعدة · وثبة' };

export default function HelpPage() {
  return (
    <WathbaShell>
      <WathbaLegalPage
        eyebrow="HELP · المساعدة"
        title="مركز المساعدة"
        intro="إجابات للأسئلة الشائعة + قنوات التواصل المباشر."
      >
        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
            marginBottom: 32,
          }}
        >
          <HelpTopicCard
            icon="favorite"
            title="للداعمين"
            body="كيف أدعم؟ ما الذي يحدث إن لم يصل المشروع لهدفه؟ كيف أتابع تنفيذ المشروع؟"
          />
          <HelpTopicCard
            icon="rocket_launch"
            title="للمبدعين"
            body="كيف أُطلق مشروعاً؟ ما هي رسوم المنصة؟ متى أستلم الدفعات؟ كيف أرفع أدلة المراحل؟"
          />
          <HelpTopicCard
            icon="category"
            title="للموردين"
            body="كيف أنضم كمورّد؟ كيف أقدّم عرضاً لطلب RFQ؟ متى أعرف نتيجة الإرساء؟"
          />
          <HelpTopicCard
            icon="shield"
            title="الأمان والخصوصية"
            body="كيف تُخزَّن بياناتي؟ ما هو نظام PDPL؟ كيف أحذف حسابي؟"
          />
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>الأسئلة الشائعة</h2>

        <LegalSection
          n="Q1"
          title="متى يُخصم مبلغ الدعم من بطاقتي؟"
          body="عند الدعم، يُحجز المبلغ فقط (Authorize). يُخصم فعلياً عند نجاح الحملة (٨٠٪+ من الهدف). إن فشلت الحملة، يُحرَّر الحجز تلقائياً ولا يُخصم شيء."
        />
        <LegalSection
          n="Q2"
          title="كيف أعرف أن المبدع سيلتزم بالتسليم؟"
          body="نموذج «الضمان بالمراحل»: التمويل يُحوَّل للمبدع على دفعات حسب مراحل التسليم، وكل مرحلة تتطلب أدلة موثّقة وموافقة المنصة. لوحة الشفافية الحيّة تُظهر تقدّم الصرف."
        />
        <LegalSection
          n="Q3"
          title="ما هي رسوم المنصة؟"
          body="٥٪ من إجمالي التمويل عند النجاح، تُحتسب فقط على الحملات الناجحة. تُضاف عليها رسوم بوّابة الدفع (~٢.٥٪)."
        />
        <LegalSection
          n="Q4"
          title="هل المعاملات شرعية ومتوافقة؟"
          body={
            <>
              نعم. نستخدم ثلاثة أنواع عقود — تبرّع، استصناع، سَلَم — يُحدَّد المناسب
              تلقائياً بحسب نوع المكافأة. كل العقود تخضع لمراجعة شرعية مستمرّة.{' '}
              تفاصيل في <a href="/projects/legal/contracts" style={{ color: 'var(--accent)' }}>صفحة العقود</a>.
            </>
          }
        />
        <LegalSection
          n="Q5"
          title="كيف أتواصل مع الدعم؟"
          body={
            <>
              بريد الدعم العام: support@wathba.sa · للقضايا التقنية: tech@wathba.sa ·
              للخصوصية والـPDPL: privacy@wathba.sa · ساعات الدعم: الأحد–الخميس ٩ص–٥م
              بتوقيت الرياض.
            </>
          }
        />
      </WathbaLegalPage>
    </WathbaShell>
  );
}
