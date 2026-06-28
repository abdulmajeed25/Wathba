import type { Metadata } from 'next';

import { LegalSection, WathbaLegalPage } from '@/components/ventures/wathba/wathba-legal';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'سياسة الخصوصية (PDPL) · وثبة' };

/**
 * Saudi PDPL (Personal Data Protection Law) — SDAIA-compliant data-handling
 * disclosure. Required by §8 of the compliance spec. This is the user-facing
 * surface; the actual consent-tracking layer (consentVersion on User, audit
 * trail of data accesses) is a separate backend task.
 */
export default function PrivacyPage() {
  return (
    <WathbaShell>
      <WathbaLegalPage
        eyebrow="PRIVACY · الخصوصية"
        title="سياسة الخصوصية (PDPL)"
        intro="تلتزم وثبة بنظام حماية البيانات الشخصية السعودي (PDPL) ولوائح سدايا. هذه السياسة توضّح أي بيانات نجمع، لماذا، وكيف تتحكّم بها."
      >
        <LegalSection
          n="1"
          title="البيانات التي نجمعها"
          body={
            <>
              <strong>للحساب:</strong> الاسم، البريد، رقم الجوال، رقم الهوية (نفاذ).{' '}
              <strong>للمعاملات:</strong> العناوين، طرق الدفع (مشفّرة لدى مَيسر).{' '}
              <strong>للاستخدام:</strong> بيانات الجلسة، الجهاز، عنوان IP — لتحسين الخدمة والأمان فقط.
            </>
          }
        />
        <LegalSection
          n="2"
          title="غايات المعالجة"
          body="(أ) تشغيل المنصة وإجراء المعاملات. (ب) التحقق من الهوية عبر نفاذ. (ج) منع الاحتيال وتطبيق AML/CFT. (د) إصدار الفواتير الإلكترونية (ZATCA Phase 2 — على عمولة المنصة فقط). (هـ) تحسين تجربة المستخدم."
        />
        <LegalSection
          n="3"
          title="مشاركة البيانات"
          body="نشارك الحد الأدنى الضروري فقط مع: بوّابة الدفع مَيسر (للمعالجة)، نفاذ (للتحقق)، ZATCA (للفواتير). لا نبيع بياناتك لطرف ثالث أبداً."
        />
        <LegalSection
          n="4"
          title="فترة الاحتفاظ"
          body="نحتفظ ببياناتك طوال فترة نشاط حسابك + ٧ سنوات بعد آخر معاملة (للالتزام بمتطلبات الفواتير والمحاسبة السعودية)، ثم تُحذف نهائياً."
        />
        <LegalSection
          n="5"
          title="حقوقك (PDPL)"
          body={
            <>
              لك الحق في: (أ) الوصول لبياناتك ونسخها. (ب) تصحيح أي بيانات خاطئة.
              (ج) حذف حسابك (مع مراعاة فترات الاحتفاظ القانونية). (د) سحب الموافقة في
              أي وقت. (هـ) رفع شكوى لدى{' '}
              <strong>الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)</strong>.
              للممارسة: privacy@wathba.sa
            </>
          }
        />
        <LegalSection
          n="6"
          title="نقل البيانات خارج المملكة"
          body="بياناتك مُخزّنة داخل المملكة. أي نقل عابر للحدود (للذكاء الاصطناعي مثلاً) يخضع لتقييم أثر صارم ومسبق وفق PDPL."
        />
        <LegalSection
          n="7"
          title="ملفات تعريف الارتباط"
          body="نستخدم ملف جلسة واحد (`wathba_session`) لتسجيل دخولك فقط. لا نستخدم cookies تتبّع إعلاني."
        />
        <LegalSection
          n="8"
          title="التواصل"
          body="مسؤول حماية البيانات (DPO): dpo@wathba.sa · للشكاوى: privacy@wathba.sa · لتعديل بياناتك: من إعدادات الملف الشخصي."
        />
      </WathbaLegalPage>
    </WathbaShell>
  );
}
