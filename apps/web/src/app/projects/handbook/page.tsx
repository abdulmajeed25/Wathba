import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalSection, WathbaLegalPage } from '@/components/ventures/wathba/wathba-legal';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = {
  title: 'دليل الناشر · وثبة',
  description:
    'دليل مبدعي وثبة: ما المسموح نشره، معايير مراجعة الحملات، التزامات التسليم، وكيف تُصرف أموال الضمان على المراحل.',
};

/** STAKES/H7 — the creator handbook: rules, review criteria, obligations. */
export default function HandbookPage() {
  return (
    <WathbaShell>
      <WathbaLegalPage
        eyebrow="HANDBOOK · دليل الناشر"
        title="دليل الناشر"
        intro="كل ما يحتاجه المبدع قبل إطلاق حملته: القواعد، معايير المراجعة، والتزامات ما بعد النجاح."
      >
        <LegalSection
          n="1"
          title="ما الذي يمكن نشره؟"
          body="مشاريع إبداعية أو إنتاجية ذات مخرَج ملموس وقابل للتسليم: منتج، عمل فني، محتوى، تقنية. يُمنع: جمع التبرعات الشخصية، الأسهم والاستثمار المالي، المنتجات المخالفة للأنظمة السعودية أو المقلَّدة، وأي محتوى مضلل."
        />
        <LegalSection
          n="2"
          title="متطلبات ما قبل الإطلاق"
          body="هوية موثقة عبر نفاذ، وصف صادق بمواصفات واضحة، هدف تمويلي مُبرَّر ببنود التكلفة، خطة مراحل تنفيذ واقعية بتواريخ، ومكافآت قابلة للوفاء. الحملات بنموذج استصناع/سَلَم تتطلب مواصفة منتج مفصلة."
        />
        <LegalSection
          n="3"
          title="معايير المراجعة"
          body="يراجع فريقنا كل حملة قبل النشر خلال أيام عمل: صدق الادعاءات، اكتمال خطة المراحل، توازن الهدف مع التكاليف، وسلامة المحتوى. قد نطلب تعديلات — الرفض يأتي دائماً مع أسباب مكتوبة وإمكانية إعادة التقديم."
        />
        <LegalSection
          n="4"
          title="أثناء الحملة"
          body="انشر تحديثات منتظمة، وردّ على تعليقات وأسئلة الداعمين — سرعة التجاوب جزء من تقييم موثوقيتك. يُمنع شراء دعم وهمي أو تضليل الداعمين بشأن التقدم."
        />
        <LegalSection
          n="5"
          title="بعد النجاح: الضمان والمراحل"
          body={
            <>
              التمويل يدخل <strong>حساب ضمان</strong> ولا يُصرف دفعة واحدة: كل مرحلة
              تُوثَّق بالأدلة (صور، فواتير، مخرجات) وتُراجع قبل صرف دفعتها. التأخر
              المتكرر أو التعثر يفعّل آلية التصعيد — وقد يصل لاسترداد المبالغ
              غير المصروفة للداعمين.
            </>
          }
        />
        <LegalSection
          n="6"
          title="التسليم والمكافآت"
          body="أنت ملتزم قانونياً بتسليم المكافآت الموعودة بمواصفاتها وتواريخها. عدِّل توقعات الداعمين مبكراً وبصراحة إن تغيّر الجدول — الصمت هو ما يُفقد الثقة، لا التأخير المُعلن."
        />
        <LegalSection
          n="7"
          title="ابدأ الآن"
          body={
            <>
              جاهز؟ ابدأ من <Link href="/projects/start" style={{ color: 'var(--accent-ink, #04773a)' }}>صفحة إطلاق مشروع</Link> — وراجع{' '}
              <Link href="/projects/pricing" style={{ color: 'var(--accent-ink, #04773a)' }}>الأسعار والعمولة</Link> و
              <Link href="/projects/legal/terms" style={{ color: 'var(--accent-ink, #04773a)' }}>الشروط والأحكام</Link> قبل التقديم.
            </>
          }
        />
      </WathbaLegalPage>
    </WathbaShell>
  );
}
