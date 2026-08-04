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
          body={
            <>
              عمولة وثبة <strong>٥٪</strong> من إجمالي التمويل، ولا تُحتسب إلا على الحملات
              الناجحة — الحملة التي لا تبلغ عتبتها لا تُكلّف شيئاً. تُضاف ضريبة القيمة
              المضافة <strong>١٥٪</strong> على العمولة نفسها (لا على كامل المبلغ).
              <br />
              رسوم مزوّد الدفع منفصلة وتختلف باختلاف وسيلة الدفع: البطاقة أقلّها، والتقسيط
              أعلى لأن تكلفته على المزوّد أعلى.{' '}
              <Link href="/projects/pricing" style={{ color: 'var(--accent)' }}>
                صفحة الرسوم
              </Link>{' '}
              تعرض الرقم الدقيق لكل وسيلة وتحسب صافي ما يصل المبدع.
            </>
          }
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
          n="Q6"
          title="كيف أشارك كمورّد في المزاد العكسي؟"
          body={
            <>
              يحتاج حسابك دور <strong>مورّد</strong> يمنحه فريق وثبة بعد التحقق. بعدها تفتح{' '}
              <Link href="/projects/supplier" style={{ color: 'var(--accent)' }}>
                بوابة الموردين
              </Link>{' '}
              وترى الطلبات المفتوحة: مواصفات كل طلب وموعد استحقاقه وعدد العروض عليه.
              <br />
              تقدّم عرضك بثلاثة أرقام — السعر، مهلة التسليم بالأيام، ونسبة الالتزام
              بالمواصفات — وتُرتَّب العروض آلياً، لكن قرار الإرساء يبقى للمبدع صاحب الطلب،
              لا للمنصة. الطلب الذي انقضى موعد استحقاقه لا يقبل عروضاً جديدة ويظهر
              «انتهى الموعد». تتابع نتيجة عروضك من تبويب «عروضي».
            </>
          }
        />
        <LegalSection
          n="Q7"
          title="ما حقوقي على بياناتي (PDPL)؟ وكيف أمارسها؟"
          body={
            <>
              لك <strong>حق الوصول</strong>: تستطيع تنزيل نسخة كاملة بصيغة JSON من كل بيان
              شخصي مخزّن عنك، من{' '}
              <Link href="/projects/settings" style={{ color: 'var(--accent)' }}>
                إعداداتك
              </Link>
              . الطلب فوري ولا يمرّ على موافقة.
              <br />
              ولك <strong>حق المحو</strong> من الصفحة نفسها. المهم أن تعرف ما يعنيه بدقّة:
              يُعطَّل الدخول وتُزال بياناتك الشخصية، لكن{' '}
              <strong>السجلات المالية تبقى</strong> لأن أنظمة مكافحة غسل الأموال تُلزمنا
              بحفظها — لا يمكننا محو فاتورة أو حركة مالية. كما يُرفض طلب المحو ما دام لديك
              تعهّد قائم في الحجز أو حملة نشطة؛ أنهِ ذلك أولاً ثم أعد الطلب.
            </>
          }
        />
        <LegalSection
          n="Q8"
          title="أين أجد فواتير الضريبة (ZATCA)؟"
          body={
            <>
              في صفحة{' '}
              <Link href="/projects/payments" style={{ color: 'var(--accent)' }}>
                المدفوعات
              </Link>{' '}
              يظهر رقم فاتورة ZATCA بجانب كل عملية لها فاتورة.
              <br />
              انتبه لما تغطّيه الفاتورة: تُصدَر على <strong>عمولة المنصة فقط</strong> — أي
              على الـ٥٪ وضريبتها — وليست فاتورة بقيمة دعمك كاملاً، لأن المبلغ الأساسي يذهب
              إلى المبدع ولا تبيعه وثبة لك.
            </>
          }
        />
        <LegalSection
          n="Q9"
          title="كيف أحمي حسابي؟"
          body={
            <>
              من{' '}
              <Link href="/projects/settings" style={{ color: 'var(--accent)' }}>
                إعداداتك
              </Link>{' '}
              ترى <strong>الجلسات النشطة</strong> على حسابك وتستطيع إنهاء أي جلسة بمفردها،
              أو الخروج من كل الأجهزة دفعة واحدة. تغيير كلمة المرور يُنهي بقية الجلسات
              تلقائياً.
              <br />
              لا نخزّن عنوان IP ولا بصمة المتصفح مع الجلسة — بشكل مقصود — لذلك تُعرَّف
              الجلسات بوقت إنشائها لا بمكانها.
            </>
          }
        />
        <LegalSection
          n="Q10"
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
        {/* «هل أجاب هذا سؤالك؟» — the rules hub answers the "may I" questions
            this page deliberately does not repeat. One canonical home each. */}
        <div
          style={{
            marginTop: 34,
            padding: '18px 20px',
            background: 'rgba(var(--accent-rgb),.06)',
            border: '1px solid rgba(var(--accent-rgb),.2)',
            borderRadius: 14,
            fontSize: 15,
            lineHeight: 1.9,
          }}
        >
          هل أجاب هذا سؤالك؟ إن كان سؤالك عن <strong>ما يُسمح بنشره</strong> — شروط قبول
          المشروع، المواد المحظورة، سياسة الذكاء الاصطناعي، أو كيف تُطبَّق القواعد
          ويُعترَض عليها — فمكانه{' '}
          <Link href="/rules" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
            صفحات القواعد
          </Link>
          . وإن لم تجد الإجابة في أيٍّ منهما، راسلنا أدناه.
        </div>

        {/* STAKES/S-15 (H4) — a contact form that actually delivers
            (stored + emailed), not just printed addresses.
            The id gives «تواصل معنا» a real destination: footers, enforcement
            screens and emails can link /projects/help#contact instead of
            dropping the reader at the top of a long FAQ. */}
        <div id="contact" style={{ marginTop: 34, scrollMarginTop: 90 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 14 }}>راسلنا مباشرة</h2>
          <WathbaContactForm />
        </div>
      </WathbaLegalPage>
    </WathbaShell>
  );
}
