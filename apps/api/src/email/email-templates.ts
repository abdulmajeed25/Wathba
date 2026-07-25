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

/**
 * OPS-GAPS Y2 — render an operator override into the shared brand layout.
 * The stored bodyAr is the inner HTML (the operator edits copy, not the shell);
 * {{APP_URL}} / {{PREFS_URL}} tokens are hydrated by EmailService as usual.
 */
export function renderOverride(subjectAr: string, bodyAr: string): EmailContent {
  return { subject: subjectAr, html: layout(bodyAr) };
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
  /** Batch OPS — account suspended/banned by the platform (users.suspend /
   *  moderation.user.ban). Transactional-critical: no prefs link. */
  accountSuspended(d: { banned: boolean; reasonAr?: string | null }): EmailContent {
    const what = d.banned ? 'حُظر' : 'عُلّق';
    return {
      subject: `${BRAND} — ${d.banned ? 'حُظر حسابك' : 'عُلّق حسابك مؤقتاً'}`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">${what} حسابك</h1>
        <p>${what} حسابك على ${BRAND}، وسُجّل خروجك من جميع الأجهزة ولن تتمكن من تسجيل الدخول.</p>
        ${d.reasonAr ? `<p><strong>السبب:</strong> ${d.reasonAr}</p>` : ''}
        <p style="font-size:13px;color:#5d6b62;margin-top:14px">إن كنت ترى أن ذلك حدث خطأً، تواصل مع support@wathba.sa.</p>`),
    };
  },
  /** Batch OPS — account reactivated (users.reactivate / moderation.user.unban). */
  accountReactivated(name: string): EmailContent {
    return {
      subject: `${BRAND} — أُعيد تفعيل حسابك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">أهلاً بعودتك يا ${name}</h1>
        <p>أُعيد تفعيل حسابك على ${BRAND} ويمكنك تسجيل الدخول الآن كالمعتاد.</p>
        ${cta('{{APP_URL}}/signin', 'تسجيل الدخول')}`),
    };
  },
  /** Batch OPS — a reply from the support team on a ticket
   *  (support.ticket.reply). Sent to the address on the ticket. */
  supportReply(d: { name: string; topic: string; replyAr: string }): EmailContent {
    return {
      subject: `${BRAND} — ردّ فريق الدعم على رسالتك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">مرحباً ${d.name}</h1>
        <p>بخصوص رسالتك (${d.topic})، هذا ردّ فريق الدعم:</p>
        <div style="background:#f4f6f1;border-radius:12px;padding:14px 16px;margin:10px 0">${d.replyAr}</div>
        <p style="font-size:13px;color:#5d6b62;margin-top:14px">يمكنك الرد بمراسلة support@wathba.sa مباشرة.</p>`),
    };
  },
  /** OPS-GAPS R2 — the winning supplier is told their bid won an RFQ. */
  rfqAwarded(d: { projectTitle: string }): EmailContent {
    return {
      subject: `${BRAND} — تمّت ترسية عرضك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">مبروك — فُزت بالترسية</h1>
        <p>تمّت ترسية عرضك على طلب التوريد الخاص بمشروع «${d.projectTitle}». سيتواصل معك صاحب المشروع لإتمام التفاصيل.</p>
        ${cta('{{APP_URL}}/projects/supplier', 'عروضي')}`),
    };
  },
  /**
   * CLOSEOUT C2 — the non-winning bidders' notice. Deliberately neutral and
   * short: it states that a decision was made and invites future bids. It
   * never names the winner or the winning price (commercially confidential).
   */
  rfqDecided(d: { projectTitle: string }): EmailContent {
    return {
      subject: `${BRAND} — نتيجة طلب التوريد`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">صدر قرار الترسية</h1>
        <p>شكراً لتقديم عرضك على طلب التوريد الخاص بمشروع «${d.projectTitle}». صدر قرار الترسية ولم يتم اختيار عرضك هذه المرة.</p>
        <p>نُقدّر وقتك، ونتمنى أن نراك في طلبات التوريد القادمة.</p>
        ${cta('{{APP_URL}}/projects/supplier', 'طلبات التوريد المتاحة')}`),
    };
  },
  /** OPS-GAPS R1 — confirmation that an appeal was received. */
  appealReceived(d: { kindAr: string }): EmailContent {
    return {
      subject: `${BRAND} — استلمنا تظلّمك`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">استلمنا تظلّمك</h1>
        <p>وصلنا تظلّمك بخصوص ${d.kindAr}. سيراجعه فريق مختلف عن الذي اتّخذ القرار الأصلي، وسنُعلمك بالنتيجة.</p>
        <p style="font-size:13px;color:#5d6b62;margin-top:14px">لا حاجة لإرسال تظلّم آخر — لكل قرار تظلّم واحد.</p>`),
    };
  },
  /** OPS-GAPS R1 — the appeal decision (outcome + written reason). */
  appealDecided(d: { kindAr: string; outcomeAr: string; reasonAr: string }): EmailContent {
    return {
      subject: `${BRAND} — نتيجة تظلّمك: ${d.outcomeAr}`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">نتيجة تظلّمك</h1>
        <p>بخصوص تظلّمك حول ${d.kindAr}، القرار: <strong>${d.outcomeAr}</strong>.</p>
        <div style="background:#f4f6f1;border-radius:12px;padding:14px 16px;margin:10px 0">${d.reasonAr}</div>
        <p style="font-size:13px;color:#5d6b62;margin-top:14px">هذا القرار نهائي على هذا التظلّم.</p>`),
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
  /** Batch PAY (Part 2/4) — 72h grace: fix the card or complete the BNPL checkout. */
  captureGrace(d: { projectTitle: string; amountHalalas: number; bnpl: boolean; link: string }): EmailContent {
    return {
      subject: d.bnpl
        ? `${BRAND} — أكمل تقسيط تعهدك لمشروع «${d.projectTitle}» خلال ٧٢ ساعة`
        : `${BRAND} — تعذّر سحب مبلغ تعهدك — حدّث بطاقتك خلال ٧٢ ساعة`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">${d.bnpl ? 'أكمل التقسيط' : 'حدّث بطاقتك'}</h1>
        <p>نجحت حملة <strong>${d.projectTitle}</strong>! ${
          d.bnpl
            ? `لإتمام تعهدك بقيمة <strong>${halalasToSar(d.amountHalalas)} ر.س</strong> أكمل خطوات التقسيط عبر مزوّدك خلال <strong>٧٢ ساعة</strong>.`
            : `تعذّر سحب مبلغ تعهدك <strong>${halalasToSar(d.amountHalalas)} ر.س</strong> (بطاقة منتهية أو رصيد غير كافٍ). حدّث بطاقتك خلال <strong>٧٢ ساعة</strong> — سنعيد المحاولة تلقائياً أيضاً.`
        }</p>
        <p><a href="${d.link}">${d.bnpl ? 'أكمل التقسيط الآن' : 'حدّث بطاقتك الآن'}</a></p>
        <p>بعد انتهاء المهلة يُلغى التعهد وتعود المكافأة للمخزون.</p>`, { showPrefs: false }),
    };
  },
  /** Batch PAY (Part 2) — the grace window expired; the pledge is released. */
  captureFailed(d: { projectTitle: string; amountHalalas: number }): EmailContent {
    return {
      subject: `${BRAND} — أُلغي تعهدك لمشروع «${d.projectTitle}»`,
      html: layout(`<h1 style="font-size:19px;margin:0 0 10px">أُلغي التعهد</h1>
        <p>انتهت مهلة الـ٧٢ ساعة دون إتمام دفع تعهدك بقيمة
        <strong>${halalasToSar(d.amountHalalas)} ر.س</strong> لمشروع <strong>${d.projectTitle}</strong>،
        فأُلغي التعهد وأُعيدت المكافأة للمخزون. لم يُسحب منك أي مبلغ.</p>`, { showPrefs: false }),
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

/**
 * OPS-GAPS Y2 — the template catalog. One descriptor per typed helper (the
 * SAME keys EmailService routes through). It powers the operator's template
 * browser/editor: a human label, whether the template is CRITICAL (locked —
 * cannot be disabled by the kind-toggle agent), the interpolation tokens the
 * default copy uses (so the editor can hint them), and a pre-rendered `sample`
 * (placeholder args) for the preview pane. `sample` is what the read layer
 * treats as the "effective" template when no DB override exists.
 */
export interface TemplateCatalogEntry {
  key: EmailTemplateName;
  labelAr: string;
  /** Locked set — a critical (money/account-security) template can never be
   *  disabled. Editing/overriding is still allowed; disabling is not. */
  critical: boolean;
  /** Interpolation tokens/fields the default copy uses — editor hints. */
  variablesAr: string[];
  /** Pre-rendered preview with placeholder args (subject + full layout html). */
  sample: EmailContent;
}

/** The critical/locked set — money-adjacent + account-security templates. */
export const CRITICAL_TEMPLATE_KEYS = [
  'verification',
  'passwordReset',
  'pledgeReceipt',
  'refundCompleted',
  'payoutSent',
  'projectFunded',
  'projectFailed',
] as const satisfies readonly EmailTemplateName[];

const CRITICAL = new Set<EmailTemplateName>(CRITICAL_TEMPLATE_KEYS);
const isCritical = (k: EmailTemplateName): boolean => CRITICAL.has(k);

export const TEMPLATE_CATALOG: readonly TemplateCatalogEntry[] = [
  {
    key: 'verification',
    labelAr: 'تفعيل الحساب',
    critical: isCritical('verification'),
    variablesAr: ['link'],
    sample: emailTemplates.verification('{{APP_URL}}/verify?token=SAMPLE'),
  },
  {
    key: 'passwordReset',
    labelAr: 'إعادة تعيين كلمة المرور',
    critical: isCritical('passwordReset'),
    variablesAr: ['link'],
    sample: emailTemplates.passwordReset('{{APP_URL}}/reset?token=SAMPLE'),
  },
  {
    key: 'welcome',
    labelAr: 'ترحيب بعد التوثيق',
    critical: isCritical('welcome'),
    variablesAr: ['name', '{{APP_URL}}'],
    sample: emailTemplates.welcome('محمد'),
  },
  {
    key: 'accountActivated',
    labelAr: 'تفعيل الحساب (المستوى الأساسي)',
    critical: isCritical('accountActivated'),
    variablesAr: ['name', '{{APP_URL}}'],
    sample: emailTemplates.accountActivated('محمد'),
  },
  {
    key: 'duplicateSignup',
    labelAr: 'محاولة تسجيل ببريد مسجّل',
    critical: isCritical('duplicateSignup'),
    variablesAr: ['{{APP_URL}}'],
    sample: emailTemplates.duplicateSignup(),
  },
  {
    key: 'passwordChanged',
    labelAr: 'إشعار تغيير كلمة المرور',
    critical: isCritical('passwordChanged'),
    variablesAr: ['{{APP_URL}}'],
    sample: emailTemplates.passwordChanged(),
  },
  {
    key: 'emailChanged',
    labelAr: 'إشعار تغيير البريد',
    critical: isCritical('emailChanged'),
    variablesAr: ['newEmailMasked'],
    sample: emailTemplates.emailChanged('m•••@example.sa'),
  },
  {
    key: 'creatorNewProject',
    labelAr: 'مشروع جديد من مبدع تتابعه',
    critical: isCritical('creatorNewProject'),
    variablesAr: ['creatorName', 'projectTitle', 'link', '{{APP_URL}}', '{{PREFS_URL}}'],
    sample: emailTemplates.creatorNewProject({
      creatorName: 'ليلى',
      projectTitle: 'مشروع تجريبي',
      link: '/projects/sample',
    }),
  },
  {
    key: 'emailChangeVerify',
    labelAr: 'تأكيد البريد الجديد',
    critical: isCritical('emailChangeVerify'),
    variablesAr: ['link'],
    sample: emailTemplates.emailChangeVerify('{{APP_URL}}/email/verify?token=SAMPLE'),
  },
  {
    key: 'captureGrace',
    labelAr: 'مهلة سحب/تقسيط ٧٢ ساعة',
    critical: isCritical('captureGrace'),
    variablesAr: ['projectTitle', 'amountHalalas', 'bnpl', 'link'],
    sample: emailTemplates.captureGrace({
      projectTitle: 'مشروع تجريبي',
      amountHalalas: 50000,
      bnpl: false,
      link: '{{APP_URL}}/pledge/fix',
    }),
  },
  {
    key: 'captureFailed',
    labelAr: 'إلغاء التعهّد بعد انتهاء المهلة',
    critical: isCritical('captureFailed'),
    variablesAr: ['projectTitle', 'amountHalalas'],
    sample: emailTemplates.captureFailed({ projectTitle: 'مشروع تجريبي', amountHalalas: 50000 }),
  },
  {
    key: 'newDeviceSignin',
    labelAr: 'تسجيل دخول من جهاز جديد',
    critical: isCritical('newDeviceSignin'),
    variablesAr: ['{{APP_URL}}'],
    sample: emailTemplates.newDeviceSignin(),
  },
  {
    key: 'milestoneReleased',
    labelAr: 'صرف مرحلة',
    critical: isCritical('milestoneReleased'),
    variablesAr: ['projectTitle', 'milestoneTitle', 'amountHalalas', '{{PREFS_URL}}'],
    sample: emailTemplates.milestoneReleased({
      projectTitle: 'مشروع تجريبي',
      milestoneTitle: 'المرحلة الأولى',
      amountHalalas: 100000,
    }),
  },
  {
    key: 'pledgeReceipt',
    labelAr: 'إيصال تعهّد',
    critical: isCritical('pledgeReceipt'),
    variablesAr: ['projectTitle', 'amountHalalas', 'tierTitle', '{{PREFS_URL}}'],
    sample: emailTemplates.pledgeReceipt({
      projectTitle: 'مشروع تجريبي',
      amountHalalas: 50000,
      tierTitle: 'الباقة الرقمية',
    }),
  },
  {
    key: 'projectFunded',
    labelAr: 'نجاح الحملة',
    critical: isCritical('projectFunded'),
    variablesAr: ['projectTitle', 'amountHalalas', '{{PREFS_URL}}'],
    sample: emailTemplates.projectFunded({ projectTitle: 'مشروع تجريبي', amountHalalas: 500000 }),
  },
  {
    key: 'projectFailed',
    labelAr: 'إخفاق الحملة وردّ المبلغ',
    critical: isCritical('projectFailed'),
    variablesAr: ['projectTitle', 'amountHalalas', '{{PREFS_URL}}'],
    sample: emailTemplates.projectFailed({ projectTitle: 'مشروع تجريبي', amountHalalas: 500000 }),
  },
  {
    key: 'refundCompleted',
    labelAr: 'اكتمال ردّ المبلغ',
    critical: isCritical('refundCompleted'),
    variablesAr: ['projectTitle', 'amountHalalas', '{{PREFS_URL}}'],
    sample: emailTemplates.refundCompleted({ projectTitle: 'مشروع تجريبي', amountHalalas: 50000 }),
  },
  {
    key: 'payoutSent',
    labelAr: 'تحويل دفعة',
    critical: isCritical('payoutSent'),
    variablesAr: ['projectTitle', 'amountHalalas', '{{PREFS_URL}}'],
    sample: emailTemplates.payoutSent({ projectTitle: 'مشروع تجريبي', amountHalalas: 500000 }),
  },
  {
    key: 'projectReviewed',
    labelAr: 'نتيجة مراجعة المشروع',
    critical: isCritical('projectReviewed'),
    variablesAr: ['projectTitle', 'approved', 'feedback', '{{PREFS_URL}}'],
    sample: emailTemplates.projectReviewed({ projectTitle: 'مشروع تجريبي', approved: true }),
  },
  {
    key: 'accountSuspended',
    labelAr: 'تعليق/حظر الحساب',
    critical: isCritical('accountSuspended'),
    variablesAr: ['banned', 'reasonAr'],
    sample: emailTemplates.accountSuspended({ banned: false, reasonAr: 'مخالفة الشروط' }),
  },
  {
    key: 'accountReactivated',
    labelAr: 'إعادة تفعيل الحساب',
    critical: isCritical('accountReactivated'),
    variablesAr: ['name', '{{APP_URL}}'],
    sample: emailTemplates.accountReactivated('محمد'),
  },
  {
    key: 'supportReply',
    labelAr: 'ردّ الدعم على تذكرة',
    critical: isCritical('supportReply'),
    variablesAr: ['name', 'topic', 'replyAr'],
    sample: emailTemplates.supportReply({
      name: 'محمد',
      topic: 'الفوترة',
      replyAr: 'شكراً لتواصلك، عالجنا المشكلة.',
    }),
  },
  {
    key: 'rfqAwarded',
    labelAr: 'ترسية عرض توريد',
    critical: isCritical('rfqAwarded'),
    variablesAr: ['projectTitle', '{{APP_URL}}'],
    sample: emailTemplates.rfqAwarded({ projectTitle: 'مشروع تجريبي' }),
  },
  {
    key: 'rfqDecided',
    labelAr: 'نتيجة طلب توريد (لغير الفائزين)',
    critical: isCritical('rfqDecided'),
    variablesAr: ['projectTitle', '{{APP_URL}}'],
    sample: emailTemplates.rfqDecided({ projectTitle: 'مشروع تجريبي' }),
  },
  {
    key: 'appealReceived',
    labelAr: 'استلام تظلّم',
    critical: isCritical('appealReceived'),
    variablesAr: ['kindAr'],
    sample: emailTemplates.appealReceived({ kindAr: 'حظر حساب' }),
  },
  {
    key: 'appealDecided',
    labelAr: 'نتيجة تظلّم',
    critical: isCritical('appealDecided'),
    variablesAr: ['kindAr', 'outcomeAr', 'reasonAr'],
    sample: emailTemplates.appealDecided({
      kindAr: 'حظر حساب',
      outcomeAr: 'رُفض',
      reasonAr: 'لا يوجد مبرر كافٍ لإلغاء القرار.',
    }),
  },
];

/** The catalog keys as a z.enum-ready tuple (for the governed comms ops). */
export const TEMPLATE_KEYS = TEMPLATE_CATALOG.map((e) => e.key) as [
  EmailTemplateName,
  ...EmailTemplateName[],
];

/** key → descriptor, for O(1) catalog lookups (preconditions/read layer). */
export const TEMPLATE_CATALOG_BY_KEY: Record<EmailTemplateName, TemplateCatalogEntry> =
  Object.fromEntries(TEMPLATE_CATALOG.map((e) => [e.key, e])) as Record<
    EmailTemplateName,
    TemplateCatalogEntry
  >;
