/**
 * STAKES/S-3 (F1/F2) — transactional email templates. Arabic-first, RTL, inline
 * styles (email clients strip <style>/external CSS). Each builder returns
 * { subject, html }; `layout()` is the shared shell (from-name وثبة, footer +
 * an unsubscribe/preferences link for non-critical mail — F3).
 */

const BRAND = 'وثبة';
const ACCENT = '#05a661';

function halalasToSar(halalas: number): string {
  return (halalas / 100).toLocaleString('ar-SA', { maximumFractionDigits: 2 });
}

function layout(bodyHtml: string, opts: { showPrefs?: boolean } = {}): string {
  const prefs = opts.showPrefs
    ? `<p style="margin:18px 0 0;font-size:12px;color:#8a958c">
         لإدارة إشعاراتك، افتح <a href="{{PREFS_URL}}" style="color:${ACCENT}">إعدادات الإشعارات</a>.
       </p>`
    : '';
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f4f6f1;font-family:'Tahoma','Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="font-weight:800;font-size:22px;color:${ACCENT};margin-bottom:18px">${BRAND}</div>
    <div style="background:#fff;border:1px solid #e6ebe3;border-radius:16px;padding:26px 24px;color:#16201b;line-height:1.9;font-size:15px">
      ${bodyHtml}
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#8a958c">© ${BRAND} — منصة دعم المشاريع الإبداعية بضمان التنفيذ.</p>
    ${prefs}
  </div></body></html>`;
}

function cta(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:12px;margin-top:8px">${label}</a>`;
}

export interface EmailContent {
  subject: string;
  html: string;
}

export const emailTemplates = {
  // ---- account (transactional-critical: no prefs link) ----
  verification(link: string): EmailContent {
    return {
      subject: `${BRAND} — فعِّل حسابك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">مرحباً بك في ${BRAND}</h1>
        <p>لتفعيل حسابك وإتمام التسجيل، اضغط الزر التالي:</p>${cta(link, 'تفعيل الحساب')}
        <p style="font-size:13px;color:#5d6b62;margin-top:14px">إن لم تُنشئ هذا الحساب، تجاهل هذه الرسالة.</p>`),
    };
  },
  passwordReset(link: string): EmailContent {
    return {
      subject: `${BRAND} — إعادة تعيين كلمة المرور`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">إعادة تعيين كلمة المرور</h1>
        <p>طلبتَ إعادة تعيين كلمة مرور حسابك. الرابط صالح لمدة محدودة:</p>${cta(link, 'تعيين كلمة مرور جديدة')}
        <p style="font-size:13px;color:#5d6b62;margin-top:14px">إن لم تطلب ذلك، فكلمة مرورك ما زالت آمنة — تجاهل الرسالة.</p>`),
    };
  },
  /** STAKES/P1 — someone tried to sign up with this (already-registered) email.
   *  Sent to the OWNER; the requester only sees a generic non-confirming error. */
  duplicateSignup(): EmailContent {
    return {
      subject: `${BRAND} — محاولة إنشاء حساب ببريدك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">لديك حساب لدينا بالفعل</h1>
        <p>سُجّلت محاولة لإنشاء حساب جديد بهذا البريد على ${BRAND}. إن كنت أنت، فسجّل دخولك مباشرة — وإن نسيت كلمة مرورك فاستعدها:</p>
        ${cta('{{APP_URL}}/forgot-password', 'استعادة كلمة المرور')}
        <p style="font-size:13px;color:#5d6b62;margin-top:14px">إن لم تكن أنت، تجاهل هذه الرسالة — حسابك آمن ولم يتغيّر شيء.</p>`),
    };
  },
  /** STAKES/E1 A12 — security notice after a password change. */
  passwordChanged(): EmailContent {
    return {
      subject: `${BRAND} — تم تغيير كلمة مرورك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">تم تغيير كلمة المرور</h1>
        <p>غُيّرت كلمة مرور حسابك للتو، وسُجّل خروجك من بقية الأجهزة.</p>
        <p style="font-size:13px;color:#5d6b62;margin-top:14px">إن لم تكن أنت من غيّرها، فاستعد كلمة مرورك فوراً وتواصل مع support@wathba.sa.</p>
        ${cta('{{APP_URL}}/forgot-password', 'استعادة كلمة المرور')}`),
    };
  },
  /** STAKES/E1 — security notice to the OLD address after an email change. */
  emailChanged(newEmailMasked: string): EmailContent {
    return {
      subject: `${BRAND} — تم تغيير بريد حسابك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">تم تغيير بريد الحساب</h1>
        <p>غُيّر بريد حسابك إلى <strong dir="ltr">${newEmailMasked}</strong>.</p>
        <p style="font-size:13px;color:#5d6b62;margin-top:14px">إن لم تكن أنت من طلب ذلك، تواصل فوراً مع support@wathba.sa.</p>`),
    };
  },
  /** STAKES/S-15 (A7/hybrid) — sent when the emailed link activates the
   *  account (baseline tier). The KYC-tier notice below stays on Nafath. */
  accountActivated(name: string): EmailContent {
    return {
      subject: `${BRAND} — حسابك مفعّل، أهلاً بك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">أهلاً ${name} 👋</h1>
        <p>تم تفعيل حسابك في ${BRAND}. يمكنك الآن التعليق ومتابعة المبدعين — ولدعم
        المشاريع أو إطلاق مشروعك ستحتاج توثيق «نفاذ» (خطوة واحدة).</p>
        ${cta('{{APP_URL}}/projects/discover', 'استكشف المشاريع')}`),
    };
  },
  welcome(name: string): EmailContent {
    return {
      subject: `${BRAND} — تم توثيق حسابك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">أهلاً ${name} 👋</h1>
        <p>تم توثيق حسابك بنجاح. يمكنك الآن دعم المشاريع أو إطلاق مشروعك الخاص على ${BRAND}.</p>
        ${cta('{{APP_URL}}/projects/discover', 'استكشف المشاريع')}`),
    };
  },

  // ---- money events (prefs link — F3) ----
  pledgeReceipt(d: { projectTitle: string; amountHalalas: number; tierTitle?: string | null }): EmailContent {
    return {
      subject: `${BRAND} — تأكيد تعهّدك لمشروع «${d.projectTitle}»`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">شكراً لدعمك! 🎉</h1>
        <p>سجّلنا تعهّدك لمشروع <strong>${d.projectTitle}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:6px 0;color:#5d6b62">المبلغ</td><td style="padding:6px 0;font-weight:700;text-align:left">${halalasToSar(d.amountHalalas)} ر.س</td></tr>
          ${d.tierTitle ? `<tr><td style="padding:6px 0;color:#5d6b62">الباقة</td><td style="padding:6px 0;text-align:left">${d.tierTitle}</td></tr>` : ''}
        </table>
        <p style="font-size:13px;color:#5d6b62">لن يُخصم المبلغ فعلياً إلا عند نجاح الحملة في بلوغ هدفها. إن لم تنجح، يُعاد إليك المبلغ تلقائياً.</p>`, { showPrefs: true }),
    };
  },
  projectFunded(d: { projectTitle: string; amountHalalas: number }): EmailContent {
    return {
      subject: `${BRAND} — نجحت حملة «${d.projectTitle}» 🎉`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">الحملة نجحت!</h1>
        <p>بلغ مشروع <strong>${d.projectTitle}</strong> هدفه بفضل دعمك. تم تحصيل تعهّدك البالغ
        <strong>${halalasToSar(d.amountHalalas)} ر.س</strong>، وينتقل المشروع الآن إلى مرحلة التنفيذ بضمان وثبة.</p>`, { showPrefs: true }),
    };
  },
  projectFailed(d: { projectTitle: string; amountHalalas: number }): EmailContent {
    return {
      subject: `${BRAND} — لم تكتمل حملة «${d.projectTitle}» — جارٍ ردّ مبلغك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">لم تبلغ الحملة هدفها</h1>
        <p>للأسف لم يبلغ مشروع <strong>${d.projectTitle}</strong> هدف التمويل. لم يُخصم منك أي مبلغ، وقد
        بدأنا ردّ تعهّدك البالغ <strong>${halalasToSar(d.amountHalalas)} ر.س</strong> تلقائياً.</p>`, { showPrefs: true }),
    };
  },
  refundCompleted(d: { projectTitle: string; amountHalalas: number }): EmailContent {
    return {
      subject: `${BRAND} — تم ردّ مبلغك من «${d.projectTitle}»`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">تم ردّ المبلغ</h1>
        <p>أُعيد إليك مبلغ <strong>${halalasToSar(d.amountHalalas)} ر.س</strong> من تعهّدك لمشروع
        <strong>${d.projectTitle}</strong>. قد يستغرق ظهوره في حسابك بضعة أيام حسب مصرفك.</p>`, { showPrefs: true }),
    };
  },
  /** STAKES/S-12 F-06 — confirm a NEW address before the email swap applies. */
  emailChangeVerify(link: string): EmailContent {
    return {
      subject: `${BRAND} — تأكيد بريدك الإلكتروني الجديد`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">تأكيد البريد الجديد</h1>
        <p>طلبتَ تغيير بريد حسابك في ${BRAND} إلى هذا العنوان. لتطبيق التغيير اضغط الرابط:</p>
        <p><a href="${link}">تأكيد البريد الجديد</a></p>
        <p>إن لم تطلب هذا التغيير فتجاهل الرسالة — لن يتغيّر شيء بدون هذا التأكيد.</p>`, { showPrefs: false }),
    };
  },
  /** STAKES/S-14 — sign-in from a browser we haven't seen before. */
  newDeviceSignin(): EmailContent {
    return {
      subject: `${BRAND} — تسجيل دخول من جهاز جديد`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">دخول من جهاز جديد</h1>
        <p>سُجّل دخول إلى حسابك في ${BRAND} من متصفح أو جهاز لم نرَه من قبل.</p>
        <p>إن كان هذا أنت فلا حاجة لأي إجراء. وإن لم يكن، غيّر كلمة مرورك فوراً من
        <a href="{{APP_URL}}/projects/settings">إعدادات الأمان</a> — تغييرها يُسجّل الخروج من كل الأجهزة.</p>`, { showPrefs: false }),
    };
  },
  /** STAKES/S-12 F-08 — a milestone released funds to the creator. */
  milestoneReleased(d: { projectTitle: string; milestoneTitle: string; amountHalalas: number }): EmailContent {
    return {
      subject: `${BRAND} — صُرفت مرحلة من مشروعك «${d.projectTitle}»`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">صُرفت مرحلة</h1>
        <p>وافقنا على مرحلة <strong>«${d.milestoneTitle}»</strong> من مشروعك
        <strong>${d.projectTitle}</strong> وصُرف لها مبلغ
        <strong>${halalasToSar(d.amountHalalas)} ر.س</strong> من محفظة الضمان.</p>
        <p>تظهر التفاصيل في لوحة مشاريعك وسجلّ الشفافية.</p>`, { showPrefs: true }),
    };
  },
  /** STAKES/S-11 F-05 — a creator you follow just launched a new project. */
  creatorNewProject(d: { creatorName: string; projectTitle: string; link: string }): EmailContent {
    return {
      subject: `${BRAND} — ${d.creatorName} أطلق مشروعاً جديداً`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">مشروع جديد ممن تتابعه</h1>
        <p><strong>${d.creatorName}</strong> — أحد المبدعين الذين تتابعهم — أطلق للتو مشروعه
        الجديد <strong>«${d.projectTitle}»</strong>.</p>
        <p>كن من أوائل الداعمين: <a href="{{APP_URL}}${d.link}">شاهد المشروع</a></p>`, { showPrefs: true }),
    };
  },
  payoutSent(d: { projectTitle: string; amountHalalas: number }): EmailContent {
    return {
      subject: `${BRAND} — تحويل دفعة مشروع «${d.projectTitle}»`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">تم تحويل دفعتك</h1>
        <p>حوّلنا دفعة بقيمة <strong>${halalasToSar(d.amountHalalas)} ر.س</strong> لمشروعك
        <strong>${d.projectTitle}</strong> إلى حسابك المسجّل.</p>`, { showPrefs: true }),
    };
  },
  projectReviewed(d: { projectTitle: string; approved: boolean; feedback?: string | null }): EmailContent {
    return d.approved
      ? {
          subject: `${BRAND} — تمت الموافقة على «${d.projectTitle}» ✅`,
          html: layout(`<h1 style="font-size:19px;margin:0 0 10px">تمت الموافقة على مشروعك</h1>
            <p>راجع فريقنا مشروع <strong>${d.projectTitle}</strong> ووافق على نشره. يمكنك الآن إطلاق حملته.</p>`, { showPrefs: true }),
        }
      : {
          subject: `${BRAND} — يحتاج «${d.projectTitle}» إلى تعديلات`,
          html: layout(`<h1 style="font-size:19px;margin:0 0 10px">مطلوب بعض التعديلات</h1>
            <p>راجعنا مشروع <strong>${d.projectTitle}</strong> ونحتاج منك بعض التعديلات قبل الموافقة:</p>
            <blockquote style="margin:10px 0;padding:10px 14px;background:#f6f2df;border-radius:10px;color:#5d6b62">${d.feedback ?? '—'}</blockquote>
            <p>عدّل مشروعك ثم أعد إرساله للمراجعة.</p>`, { showPrefs: true }),
        };
  },
};

export type EmailTemplateName = keyof typeof emailTemplates;
