'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { ApiUserMe } from '@/lib/api/wathba';
import {
  changeEmailAction,
  changePasswordAction,
  deleteAccountAction,
  saveNotificationPrefsAction,
  savePrivacyAction,
  signOutAction,
  signOutAllAction,
  updateProfileAction,
} from '@/lib/auth/actions';
import { Icon, Num } from './wathba-icons';
import { WathbaProfileCompleteness } from './wathba-profile-completeness';
import { WathbaTabs, WathbaTabsContent } from './wathba-tabs';

type TabId = 'profile' | 'addresses' | 'language' | 'security' | 'notifications' | 'privacy';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'profile',       label: 'الملف الشخصي',  icon: 'person' },
  { id: 'addresses',     label: 'العناوين',       icon: 'category' },
  { id: 'language',      label: 'اللغة والمظهر',  icon: 'palette' },
  { id: 'security',      label: 'الأمان',          icon: 'shield' },
  { id: 'notifications', label: 'الإشعارات',      icon: 'notifications' },
  { id: 'privacy',       label: 'الخصوصية',       icon: 'lock' },
];

/** STAKES/S-7 — land on the tab that produced the flash flag. */
function tabForFlag(ok?: string | null, err?: string | null): TabId {
  const flag = ok ?? err ?? '';
  if (['password', 'email', 'emailpending', 'pwshort', 'pwmismatch', 'badpass', 'emailtaken', 'emailmissing'].includes(flag)) return 'security';
  if (['notifs'].includes(flag)) return 'notifications';
  if (['privacy', 'erase409', 'confirm'].includes(flag)) return 'privacy';
  return 'profile';
}

export function WathbaSettings({
  me,
  okFlag,
  errFlag,
}: {
  me?: ApiUserMe | null;
  okFlag?: string | null;
  errFlag?: string | null;
}) {
  const [tab, setTab] = useState<TabId>(() => tabForFlag(okFlag, errFlag));

  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 26px 0' }}>
        <Num style={{ display: 'block', fontSize: 12, letterSpacing: 2, color: 'var(--accent-ink)', marginBottom: 8 }}>
          SETTINGS · الإعدادات
        </Num>
        <h1 style={{ fontSize: 38, fontWeight: 700, marginBottom: 8 }}>
          إعدادات الحساب
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-soft)', maxWidth: 720, lineHeight: 1.6 }}>
          إدارة بياناتك، عناوين الشحن، اللغة والمظهر، خيارات الأمان، وتفضيلات
          الإشعارات.
        </p>
      </section>

      <WathbaTabs tabs={TABS} value={tab} onValueChange={(v) => setTab(v as TabId)} maxWidth={1040}>
        <section style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 26px 80px' }}>
          <WathbaTabsContent value="profile">
            <ProfileTab me={me} okFlag={okFlag} errFlag={errFlag} />
          </WathbaTabsContent>
          <WathbaTabsContent value="addresses"><AddressesTab /></WathbaTabsContent>
          <WathbaTabsContent value="language"><LanguageTab me={me} /></WathbaTabsContent>
          <WathbaTabsContent value="security">
            <SecurityTab me={me} okFlag={okFlag} errFlag={errFlag} />
          </WathbaTabsContent>
          <WathbaTabsContent value="notifications">
            <NotificationsTab me={me} okFlag={okFlag} errFlag={errFlag} />
          </WathbaTabsContent>
          <WathbaTabsContent value="privacy">
            <PrivacyTab me={me} okFlag={okFlag} errFlag={errFlag} />
          </WathbaTabsContent>
        </section>
      </WathbaTabs>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── tabs ── */

/** STAKES/S-4 — Arabic copy per error code (F-rule: errorCode ↔ key, 1:1). */
const PROFILE_ERRORS: Record<string, string> = {
  handle: 'هذا المعرّف مستخدم أو محجوز — جرّب معرّفاً آخر.',
  server: 'تعذّر حفظ التغييرات — حاول مجدداً.',
  network: 'تعذّر الاتصال بالخادم — تحقق من الشبكة وحاول مجدداً.',
};

function ProfileTab({
  me, okFlag, errFlag,
}: { me?: ApiUserMe | null; okFlag?: string | null; errFlag?: string | null }) {
  return (
    <div style={{ maxWidth: 640 }}>
    {/* STAKES/S-11 F-18 (C8) — completion nudge above the editable form. */}
    {me && <WathbaProfileCompleteness me={me} />}
    <form
      action={updateProfileAction}
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 16, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 18,
        maxWidth: 640,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>الملف الشخصي</h2>
        {me?.handle && (
          <Link href={`/u/${me.handle}`} style={{
            fontSize: 12.5, fontWeight: 700, color: 'var(--accent-ink)',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(var(--accent-rgb),.35)',
          }}>
            <Icon name="visibility" size={14} color="var(--accent-ink)" /> عرض ملفي العام
          </Link>
        )}
      </div>

      {okFlag === 'profile' && (
        <div style={{
          padding: '10px 14px', borderRadius: 11,
          background: 'rgba(52,211,153,.10)', color: 'var(--pos-ink)',
          border: '1px solid rgba(52,211,153,.30)',
          fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="check_circle" size={16} color="var(--pos)" />
          تم حفظ التغييرات بنجاح.
        </div>
      )}
      {errFlag && (
        <div style={{
          padding: '10px 14px', borderRadius: 11,
          background: 'rgba(239,68,68,.08)', color: '#dc2626',
          border: '1px solid rgba(239,68,68,.30)',
          fontSize: 13,
        }}>
          {PROFILE_ERRORS[errFlag] ?? PROFILE_ERRORS.server}
        </div>
      )}

      <AvatarField me={me} />

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>الاسم الكامل</span>
        <input
          type="text" name="name"
          defaultValue={me?.name ?? ''}
          minLength={2} maxLength={80}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>المعرّف العام (رابط ملفك: /u/المعرّف)</span>
        <input
          type="text" name="handle" dir="ltr"
          defaultValue={me?.handle ?? ''}
          minLength={3} maxLength={30}
          pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]{2,29}"
          placeholder="sara-alamri"
          style={{ ...inputStyle, textAlign: 'left' }}
        />
        <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
          3–30 حرفاً لاتينياً أو رقماً أو (ـ . -). يظهر في رابط ملفك العام.
        </span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>نبذة عنك</span>
        <textarea
          name="bioAr" rows={3} maxLength={600}
          defaultValue={me?.bioAr ?? ''}
          placeholder="عرّف زوار ملفك بنفسك واهتماماتك…"
          style={{ ...inputStyle, resize: 'vertical', minHeight: 84 }}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>المدينة</span>
          <input
            type="text" name="city" maxLength={80}
            defaultValue={me?.city ?? ''}
            placeholder="الرياض"
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>موقعك الإلكتروني</span>
          <input
            type="url" name="websiteUrl" dir="ltr" maxLength={300}
            defaultValue={me?.websiteUrl ?? ''}
            placeholder="https://example.sa"
            style={{ ...inputStyle, textAlign: 'left' }}
          />
        </label>
      </div>

      <SocialLinksFields me={me} />

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>البريد الإلكتروني</span>
        <input
          type="email"
          defaultValue={me?.email ?? ''}
          disabled
          style={{ ...inputStyle, opacity: 0.65, cursor: 'not-allowed' }}
        />
        {/* STAKES/S-12 F-06 — points at the REAL flow (the old copy said
            "contact support" while the security tab could actually edit it). */}
        <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
          لتغيير البريد انتقل إلى تبويب «الأمان» — يتطلب كلمة المرور وتأكيداً عبر البريد الجديد.
        </span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>رقم الجوال</span>
        <input
          type="tel" name="phone"
          defaultValue={me?.phone ?? ''}
          placeholder="+9665XXXXXXXX"
          pattern="^\+?\d{8,15}$"
          style={inputStyle}
        />
      </label>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderRadius: 12,
        background: me?.nafathVerified
          ? 'rgba(52,211,153,.10)'
          : 'rgba(251,191,36,.10)',
        border: `1px solid ${me?.nafathVerified ? 'rgba(52,211,153,.30)' : 'rgba(251,191,36,.30)'}`,
      }}>
        <Icon name="verified_user" size={20} color={me?.nafathVerified ? 'var(--pos)' : 'var(--gold)'} />
        <div style={{ flex: 1, fontSize: 13, color: 'var(--text-soft)' }}>
          <strong>تحقّق نفاذ:</strong>{' '}
          {me?.nafathVerified ? 'مؤكَّدة ✓' : 'غير مؤكَّدة — مطلوبة قبل إطلاق المشاريع.'}
        </div>
        {!me?.nafathVerified && (
          <Link href="/sign-up/nafath" style={{
            background: 'var(--grad)', color: 'var(--on-accent)',
            textDecoration: 'none', padding: '8px 14px',
            borderRadius: 10, fontSize: 12, fontWeight: 700,
          }}>
            تحقّق الآن
          </Link>
        )}
      </div>

      <button type="submit" style={{
        background: 'var(--grad)', color: 'var(--on-accent)',
        border: 'none', fontFamily: 'inherit', fontWeight: 700,
        fontSize: 14, padding: '12px 22px', borderRadius: 12,
        cursor: 'pointer', alignSelf: 'flex-start',
      }}>
        حفظ التغييرات
      </button>
    </form>
    </div>
  );
}

function AddressesTab() {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid rgba(var(--ink-rgb),.08)',
      borderRadius: 16, padding: 28, maxWidth: 640,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <h2 style={{ fontSize: 19, fontWeight: 700 }}>عناوين الشحن</h2>
      <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65 }}>
        إذا اخترت مكافأة تتطلب شحناً مادياً (استصناع/سَلَم)، يُطلب منك إدخال
        عنوان الشحن أثناء عملية الدعم. تُخزَّن العناوين على مستوى الدعم وليس
        على مستوى الحساب — هذا يُقلّل من البيانات الشخصية المخزّنة لدينا ويتوافق
        مع نظام حماية البيانات الشخصية (PDPL).
      </p>
      <p style={{ fontSize: 13, color: 'var(--muted2)' }}>
        لمراجعة عنوان دعمٍ سابق، افتح صفحة الدعم من{' '}
        <Link href="/projects/me/pledges" style={{ color: 'var(--accent-ink)' }}>«تعهّداتي»</Link>.
      </p>
    </div>
  );
}

function LanguageTab({ me }: { me?: ApiUserMe | null }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid rgba(var(--ink-rgb),.08)',
      borderRadius: 16, padding: 24, maxWidth: 640,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <h2 style={{ fontSize: 19, fontWeight: 700 }}>اللغة والمظهر</h2>

      <Row label="اللغة" value={me?.locale === 'en' ? 'English' : 'العربية (افتراضي)'}>
        <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
          الإنجليزية متاحة في تحديث قادم.
        </span>
      </Row>

      <Row label="المظهر" value="حسب نظام التشغيل">
        <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
          بدّل المظهر يدوياً من زر القمر/الشمس في رأس الصفحة.
        </span>
      </Row>

      <Row label="العملة" value="الريال السعودي (SAR)">
        <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
          كل المعاملات على وثبة بالريال السعودي.
        </span>
      </Row>
    </div>
  );
}

function SecurityTab({
  me, okFlag, errFlag,
}: { me?: ApiUserMe | null; okFlag?: string | null; errFlag?: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      <Flash okFlag={okFlag} errFlag={errFlag} scope="security" />

      {/* STAKES/E1 — real password change with current-password check. */}
      <form action={changePasswordAction} style={cardForm}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>تغيير كلمة المرور</h2>
        <label style={fieldCol}>
          <span style={fieldLabel}>كلمة المرور الحالية</span>
          <input type="password" name="currentPassword" required minLength={8} autoComplete="current-password" style={inputStyle} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={fieldCol}>
            <span style={fieldLabel}>كلمة المرور الجديدة</span>
            <input type="password" name="newPassword" required minLength={8} autoComplete="new-password" style={inputStyle} />
          </label>
          <label style={fieldCol}>
            <span style={fieldLabel}>تأكيد الجديدة</span>
            <input type="password" name="confirm" required minLength={8} autoComplete="new-password" style={inputStyle} />
          </label>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted2)' }}>
          بعد التغيير يُسجَّل خروجك من بقية الأجهزة تلقائياً (يبقى هذا الجهاز).
        </p>
        <button type="submit" style={primaryBtn}>حفظ كلمة المرور</button>
      </form>

      {/* STAKES/E1 + S-12 F-06 — email change is verify-first: a confirmation
          link goes to the NEW address; nothing changes until it's clicked. */}
      <form action={changeEmailAction} style={cardForm}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>تغيير البريد الإلكتروني</h2>
        <p style={{ fontSize: 12.5, color: 'var(--muted2)' }}>
          بريدك الحالي: <strong dir="ltr">{me?.email ?? '—'}</strong>
          {me?.emailVerified === false && (
            <span style={{ display: 'inline-block', marginInlineStart: 8, padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(212,167,44,.16)', color: '#9a6700' }}>
              غير مفعّل
            </span>
          )}
        </p>
        <label style={fieldCol}>
          <span style={fieldLabel}>البريد الجديد</span>
          <input type="email" name="newEmail" required dir="ltr" style={{ ...inputStyle, textAlign: 'left' }} />
        </label>
        <label style={fieldCol}>
          <span style={fieldLabel}>كلمة المرور (للتأكيد)</span>
          <input type="password" name="currentPassword" required minLength={8} autoComplete="current-password" style={inputStyle} />
        </label>
        <p style={{ fontSize: 12, color: 'var(--muted2)' }}>
          سيصلك رابط تأكيد على البريد الجديد — لن يتغيّر شيء قبل الضغط عليه،
          ويصل إشعار أمني إلى بريدك القديم بعد التطبيق.
        </p>
        <button type="submit" style={primaryBtn}>حفظ البريد</button>
      </form>

      {/* STAKES/E5 — sessions. */}
      <div style={cardForm}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>الجلسات</h2>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          أنت مسجَّل دخولك على هذا الجهاز. إن شككت بوصولٍ غير مصرّح، سجّل الخروج
          من جميع الأجهزة — ستُبطل كل الجلسات فوراً وتحتاج لتسجيل الدخول من جديد.
        </p>
        {/* STAKES/S-15 (E5) — enumerated active sessions + per-session revoke.
            No device names by design (we store no UA/IP on sessions). */}
        <SessionsList />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <form action={signOutAction}>
            <button type="submit" style={dangerGhostBtn}>تسجيل الخروج من هذا الجهاز</button>
          </form>
          <form action={signOutAllAction}>
            <button type="submit" style={dangerGhostBtn}>تسجيل الخروج من جميع الأجهزة</button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** STAKES/S-15 (E5) — active refresh-token sessions (created/expiry only). */
function SessionsList() {
  const [rows, setRows] = useState<Array<{ id: string; createdAt: string; expiresAt: string }> | null>(null);
  const load = async (): Promise<void> => {
    try {
      const r = await fetch('/api/me/sessions');
      if (r.ok) setRows(((await r.json()) as { items: Array<{ id: string; createdAt: string; expiresAt: string }> }).items);
    } catch {
      /* leave null */
    }
  };
  useEffect(() => { void load(); }, []);
  if (!rows) return null;
  return (
    <div data-testid="sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>الجلسات النشطة ({rows.length})</div>
      {rows.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid rgba(var(--ink-rgb),.1)', borderRadius: 11, padding: '9px 13px' }}>
          <Num style={{ fontSize: 12, color: 'var(--muted)' }}>
            بدأت {new Date(r.createdAt).toLocaleDateString('en-GB')} · تنتهي {new Date(r.expiresAt).toLocaleDateString('en-GB')}
          </Num>
          <button
            type="button"
            onClick={() => {
              void fetch(`/api/me/sessions/${r.id}`, { method: 'DELETE' }).then(() => void load());
            }}
            style={{ cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'transparent', border: '1px solid rgba(220,38,38,.35)', borderRadius: 9, padding: '5px 12px', minHeight: 24 }}
          >
            إلغاء الجلسة
          </button>
        </div>
      ))}
    </div>
  );
}

function NotificationsTab({
  me, okFlag, errFlag,
}: { me?: ApiUserMe | null; okFlag?: string | null; errFlag?: string | null }) {
  const prefs = me?.notificationPrefs ?? {
    projectUpdates: true, campaignOutcomes: true, comments: true, marketing: false,
  };
  return (
    <form action={saveNotificationPrefsAction} style={{ ...cardForm, maxWidth: 640 }}>
      <Flash okFlag={okFlag} errFlag={errFlag} scope="notifications" />
      <h2 style={{ fontSize: 19, fontWeight: 700 }}>تفضيلات الإشعارات</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted2)', lineHeight: 1.6 }}>
        إشعارات الأموال الحرجة (إيصالات التعهد، الاستردادات، الصرف) تصل دائماً —
        هذه التفضيلات تتحكم بالباقي.
      </p>

      <PrefToggle name="projectUpdates" label="تحديثات المشاريع المدعومة"
        hint="إشعار عند نشر تحديث في مشروع دعمته أو تتابع صاحبه." defaultOn={prefs.projectUpdates ?? true} />
      <PrefToggle name="campaignOutcomes" label="نتائج الحملات (بريد)"
        hint="بريد نجاح/فشل الحملة — يبقى إشعار داخل المنصة دائماً." defaultOn={prefs.campaignOutcomes ?? true} />
      <PrefToggle name="comments" label="الردود على تعليقاتي"
        hint="إشعار عندما يرد أحدهم على تعليقك." defaultOn={prefs.comments ?? true} />
      <PrefToggle name="marketing" label="رسائل تسويقية"
        hint="مشاريع مقترحة وأخبار وثبة — معطّلة افتراضياً." defaultOn={prefs.marketing ?? false} />

      <button type="submit" style={{ ...primaryBtn, alignSelf: 'flex-start' }}>حفظ التفضيلات</button>
    </form>
  );
}

/** STAKES/E3 E4 — privacy toggles + the PDPL rights block. */
function PrivacyTab({
  me, okFlag, errFlag,
}: { me?: ApiUserMe | null; okFlag?: string | null; errFlag?: string | null }) {
  const [confirmPhrase, setConfirmPhrase] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      <Flash okFlag={okFlag} errFlag={errFlag} scope="privacy" />

      <form action={savePrivacyAction} style={cardForm}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>الخصوصية</h2>
        <PrefToggle name="profilePublic" label="ملفي العام ظاهر"
          hint="عند الإيقاف يختفي ملفك (/u/…) تماماً — كأن الرابط غير موجود."
          defaultOn={me?.profilePublic ?? true} />
        <PrefToggle name="showBackedCount" label="إظهار عدد المشاريع التي دعمتها"
          hint="يتحكم بظهور العدّاد في ملفك العام."
          defaultOn={me?.showBackedCount ?? true} />
        <button type="submit" style={{ ...primaryBtn, alignSelf: 'flex-start' }}>حفظ الخصوصية</button>
      </form>

      {/* STAKES/E4 — PDPL rights: export + typed-confirmation erasure. */}
      <div style={cardForm}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>بياناتك (PDPL)</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>
          يحق لك الحصول على نسخة كاملة من بياناتك المخزّنة لدينا، أو حذف حسابك
          نهائياً (تُجهَّل بياناتك الشخصية وتُعطَّل إمكانية الدخول؛ تُحتفظ السجلات
          المالية وفق متطلبات مكافحة غسل الأموال).
        </p>
        <a href="/api/me/export" download style={{
          ...primaryBtn, textDecoration: 'none', display: 'inline-block', width: 'fit-content',
        }}>
          تصدير بياناتي (JSON)
        </a>
      </div>

      <div style={{
        ...cardForm,
        border: '1px solid rgba(239,68,68,.35)',
      }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: '#dc2626' }}>حذف الحساب</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>
          إجراء نهائي لا يمكن التراجع عنه. لا يمكن الحذف وهناك تعهدات في الضمان
          أو حملة نشطة باسمك. اكتب <strong>حذف حسابي</strong> للتأكيد.
        </p>
        <form action={deleteAccountAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text" name="confirmPhrase" dir="rtl"
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder="حذف حسابي"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={confirmPhrase.trim() !== 'حذف حسابي'}
            style={{
              ...dangerGhostBtn,
              background: confirmPhrase.trim() === 'حذف حسابي' ? '#dc2626' : 'transparent',
              color: confirmPhrase.trim() === 'حذف حسابي' ? '#fff' : '#dc2626',
              opacity: confirmPhrase.trim() === 'حذف حسابي' ? 1 : 0.6,
              cursor: confirmPhrase.trim() === 'حذف حسابي' ? 'pointer' : 'not-allowed',
              alignSelf: 'flex-start',
            }}
          >
            احذف حسابي نهائياً
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────── S-7 shared atoms ── */

const SETTINGS_MESSAGES: Record<string, { text: string; ok: boolean; scope: string }> = {
  password:     { text: 'تم تغيير كلمة المرور — وسُجّل خروجك من بقية الأجهزة.', ok: true,  scope: 'security' },
  email:        { text: 'تم تغيير البريد الإلكتروني بنجاح.',                    ok: true,  scope: 'security' },
  emailpending: { text: 'أرسلنا رابط تأكيد إلى بريدك الجديد — لن يتغيّر شيء قبل الضغط عليه.', ok: true, scope: 'security' },
  notifs:       { text: 'حُفظت تفضيلات الإشعارات.',                             ok: true,  scope: 'notifications' },
  privacy:      { text: 'حُفظت إعدادات الخصوصية.',                              ok: true,  scope: 'privacy' },
  pwshort:      { text: 'كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.', ok: false, scope: 'security' },
  pwmismatch:   { text: 'كلمتا المرور غير متطابقتين.',                          ok: false, scope: 'security' },
  badpass:      { text: 'كلمة المرور الحالية غير صحيحة.',                       ok: false, scope: 'security' },
  emailtaken:   { text: 'تعذّر استخدام هذا البريد — جرّب بريداً آخر.',           ok: false, scope: 'security' },
  emailmissing: { text: 'أدخل البريد الجديد.',                                  ok: false, scope: 'security' },
  confirm:      { text: 'اكتب «حذف حسابي» في حقل التأكيد.',                     ok: false, scope: 'privacy' },
  erase409:     { text: 'لا يمكن حذف الحساب الآن — لديك تعهدات في الضمان أو حملة نشطة. بعد تسويتها يمكنك الحذف.', ok: false, scope: 'privacy' },
};

function Flash({ okFlag, errFlag, scope }: { okFlag?: string | null; errFlag?: string | null; scope: string }) {
  const key = okFlag ?? errFlag;
  if (!key) return null;
  const msg = SETTINGS_MESSAGES[key];
  if (!msg || msg.scope !== scope) return null;
  return (
    <div role={msg.ok ? 'status' : 'alert'} style={{
      padding: '10px 14px', borderRadius: 11, fontSize: 13,
      background: msg.ok ? 'rgba(52,211,153,.10)' : 'rgba(239,68,68,.08)',
      color: msg.ok ? 'var(--pos-ink)' : '#dc2626',
      border: `1px solid ${msg.ok ? 'rgba(52,211,153,.30)' : 'rgba(239,68,68,.30)'}`,
    }}>
      {msg.text}
    </div>
  );
}

/** Form-submittable toggle: a real checkbox styled as the switch. */
function PrefToggle({ name, label, hint, defaultOn }: { name: string; label: string; hint: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
      padding: '10px 0', borderBottom: '1px solid rgba(var(--ink-rgb),.04)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{hint}</div>
      </div>
      <input type="checkbox" name={name} checked={on} onChange={() => setOn((v) => !v)} style={{ display: 'none' }} readOnly />
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        role="switch"
        aria-checked={on}
        aria-label={label}
        style={{
          position: 'relative', width: 46, height: 26, borderRadius: 20, flexShrink: 0,
          border: 'none', cursor: 'pointer',
          background: on ? 'var(--grad)' : 'rgba(var(--ink-rgb),.15)',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
          background: 'var(--chip-fill)',
          ...(on ? { right: 3 } : { left: 3 }),
          transition: 'all .2s',
        }} />
      </button>
    </div>
  );
}

const cardForm: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid rgba(var(--ink-rgb),.08)',
  borderRadius: 16, padding: 24,
  display: 'flex', flexDirection: 'column', gap: 16,
};
const fieldCol: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const fieldLabel: React.CSSProperties = { fontSize: 13, color: 'var(--text-soft)' };
const primaryBtn: React.CSSProperties = {
  background: 'var(--grad)', color: 'var(--on-accent)',
  border: 'none', fontFamily: 'inherit', fontWeight: 700,
  fontSize: 14, padding: '12px 22px', borderRadius: 12,
  cursor: 'pointer', alignSelf: 'flex-start',
};
const dangerGhostBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(239,68,68,.30)',
  color: '#dc2626', fontFamily: 'inherit', fontWeight: 700,
  fontSize: 13, padding: '10px 18px', borderRadius: 11, cursor: 'pointer',
};

/* ────────────────────────────────── STAKES/S-4 identity fields ── */

/* ────────────────────────────────── STAKES/S-4 identity fields ── */

/** C2 — avatar upload: presigned PUT to MinIO (kind:'avatar', ≤2MB) then the
 *  publicUrl rides the form in a hidden input; initials fallback otherwise. */
function AvatarField({ me }: { me?: ApiUserMe | null }) {
  const [url, setUrl] = useState<string | null>(me?.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pick = async (rawFile: File) => {
    setErr(null);
    if (rawFile.size > 2 * 1024 * 1024) { setErr('حجم الصورة يتجاوز 2 ميغابايت.'); return; }
    setBusy(true);
    try {
      // STAKES/S-15 (C2) — square center-crop + resize to 512px client-side,
      // so avatars are uniform and uploads stay tiny. Falls back to the raw
      // file when canvas/decode is unavailable.
      const file = await cropSquare(rawFile, 512).catch(() => rawFile);
      const presignRes = await fetch('/api/media/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'avatar', mimeType: file.type || 'image/jpeg', sizeBytes: file.size }),
      });
      if (!presignRes.ok) throw new Error(`فشل تحضير الرفع (${presignRes.status})`);
      const presign = (await presignRes.json()) as { url: string; publicUrl: string };
      const putRes = await fetch(presign.url, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'image/jpeg' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`فشل رفع الصورة (${putRes.status})`);
      setUrl(presign.publicUrl);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const initial = (me?.name ?? '؟').trim().charAt(0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <input type="hidden" name="avatarUrl" value={url ?? ''} />
      {url ? (
        /* STAKES/M2 — next/image: lazy + fixed dimensions (no CLS). */
        <Image src={url} alt="الصورة الشخصية" width={64} height={64}
          style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(var(--accent-rgb),.25)' }} />
      ) : (
        <div aria-hidden style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(var(--accent-rgb),.14)', color: 'var(--accent-ink)',
          display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 24,
        }}>{initial}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} style={{
            background: 'transparent', border: '1px solid rgba(var(--accent-rgb),.4)',
            color: 'var(--accent-ink)', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5,
            padding: '8px 14px', borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
          }}>
            {busy ? 'جارٍ الرفع…' : 'تغيير الصورة'}
          </button>
          {url && (
            <button type="button" onClick={() => setUrl(null)} style={{
              background: 'transparent', border: '1px solid rgba(239,68,68,.3)', color: '#dc2626',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, padding: '8px 14px',
              borderRadius: 10, cursor: 'pointer',
            }}>
              إزالة
            </button>
          )}
        </div>
        <span style={{ fontSize: 11.5, color: err ? '#dc2626' : 'var(--muted2)' }}>
          {err ?? 'JPG / PNG / WebP — بحد أقصى 2 ميغابايت.'}
        </span>
      </div>
      <input
        ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ''; }}
      />
    </div>
  );
}

/** C4 — five optional, validated social URLs (X/Instagram/LinkedIn/YouTube/TikTok). */
const SOCIAL_PLATFORMS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: 'x',         label: 'X',         placeholder: 'https://x.com/…' },
  { key: 'instagram', label: 'إنستغرام',  placeholder: 'https://instagram.com/…' },
  { key: 'linkedin',  label: 'لينكدإن',   placeholder: 'https://linkedin.com/in/…' },
  { key: 'youtube',   label: 'يوتيوب',    placeholder: 'https://youtube.com/@…' },
  { key: 'tiktok',    label: 'تيك توك',   placeholder: 'https://tiktok.com/@…' },
];

function SocialLinksFields({ me }: { me?: ApiUserMe | null }) {
  const existing = new Map((me?.socialLinks ?? []).map((s) => [s.platform, s.url]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13, color: 'var(--text-soft)', fontWeight: 600 }}>روابط التواصل (اختيارية)</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {SOCIAL_PLATFORMS.map((p) => (
          <label key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{p.label}</span>
            <input
              type="url" name={`social_${p.key}`} dir="ltr" maxLength={300}
              defaultValue={existing.get(p.key) ?? ''}
              placeholder={p.placeholder}
              pattern="https://.*"
              style={{ ...inputStyle, textAlign: 'left', fontSize: 13, padding: '10px 12px' }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── shared atoms ── */

function Row({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 14, padding: '10px 0',
      borderBottom: '1px solid rgba(var(--ink-rgb),.04)',
    }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12.5 }}>{children}</div>
      </div>
      <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 700, textAlign: 'end' }}>{value}</span>
    </div>
  );
}


const inputStyle: React.CSSProperties = {
  background: 'rgba(var(--ink-rgb),.04)',
  border: '1px solid rgba(var(--ink-rgb),.12)',
  borderRadius: 11,
  padding: '12px 14px',
  fontSize: 14,
  color: 'var(--text)',
  fontFamily: 'inherit',
  // AN <input> HAS AN INTRINSIC WIDTH. Its default `size` is 20 characters, so
  // with no width set each field insisted on roughly 200px — and because a
  // grid/flex item's min-width defaults to auto, the City/Website pair could
  // not shrink below the two of them side by side. The form measured 658px
  // inside a 306px box on a phone, which then widened the whole settings page
  // to 685px. Every field here already sits in a full-width column, so 100%
  // changes nothing on desktop and is what lets them shrink on a phone.
  width: '100%',
  minWidth: 0,
};

/** STAKES/S-15 (C2) — square center-crop + resize via canvas → JPEG 0.9. */
async function cropSquare(file: File, size: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
  if (!blob) throw new Error('encode failed');
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}
