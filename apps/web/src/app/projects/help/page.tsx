import type { Metadata } from 'next';
import Link from 'next/link';

import {
  HelpTopicCard,
  LegalSection,
  WathbaLegalPage,
} from '@/components/ventures/wathba/wathba-legal';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaContactForm } from '@/components/ventures/wathba/wathba-contact-form';

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
          body="عند الدعم يُحجز المبلغ فقط دون خصم. التقييم يحدث مرة واحدة عند الموعد النهائي للحملة: إن كانت التعهدات حينها ٨٠٪ فأكثر من الهدف يُخصم المبلغ، وإلا يُحرَّر الحجز تلقائياً. تجاوز الحملة نسبة ٨٠٪ أثناء سيرها لا يُفعّل أي خصم — العبرة بلحظة الإغلاق فقط. ملاحظة: النسبة تُحسب على التعهدات عند الإغلاق؛ قد يقل المبلغ المُحصَّل فعلياً قليلاً بعدها إذا تعذّر السحب من بعض البطاقات."
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
              تفاصيل في <Link href="/projects/legal/contracts" style={{ color: 'var(--accent)' }}>صفحة العقود</Link>.
            </>
          }
        />
        <LegalSection
          n="Q5أ"
          title="هل أستطيع إلغاء تعهدي؟"
          body="نعم — الإلغاء متاح مجاناً طوال فترة الحملة وحتى ٤٨ ساعة قبل موعد الإغلاق. في الساعات الـ٤٨ الأخيرة تُقفل التعهدات فلا إلغاء ولا تخفيض (الزيادة أو تعهد جديد يبقيان متاحين). عند الإلغاء يُفكّ حجز المبلغ فوراً."
        />
        <LegalSection
          n="Q5ب"
          title="ماذا لو تعذّر السحب من بطاقتي عند نجاح الحملة؟"
          body="نجاح الحملة يتقرر بمبلغ التعهدات لحظة الإغلاق ولا يتأثر بنتائج السحب. إن تعذّر السحب (بطاقة منتهية أو رصيد غير كافٍ) تحصل على مهلة ٧٢ ساعة لتحديث بطاقتك عبر رابط آمن، مع محاولات تلقائية بعد ٦ و٢٤ و٤٨ ساعة. بعد انقضاء المهلة يُلغى التعهد وتعود المكافأة للمخزون — دون أي خصم منك."
        />
        <LegalSection
          n="Q5ج"
          title="كيف يعمل الدفع بالتقسيط (تابي / تمارا)؟"
          body="اختر «قسّطها» عند التعهد فيُسجَّل تعهدك ويُحتسب في عدّاد الحملة فوراً — لكن لا يُنشأ أي عقد تقسيط ولا يُخصم شيء إلا إذا نجحت الحملة عند موعد إغلاقها. عندها تُكمل خطوات التقسيط عبر المزوّد خلال ٧٢ ساعة. إن لم تنجح الحملة يُلغى الطلب تلقائياً دون أي أثر."
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
        {/* STAKES/S-15 (H4) — a contact form that actually delivers
            (stored + emailed), not just printed addresses. */}
        <div style={{ marginTop: 34 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 14 }}>راسلنا مباشرة</h2>
          <WathbaContactForm />
        </div>
      </WathbaLegalPage>
    </WathbaShell>
  );
}
