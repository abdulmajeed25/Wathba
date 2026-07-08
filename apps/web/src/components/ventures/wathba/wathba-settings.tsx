'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

import type { ApiUserMe } from '@/lib/api/wathba';
import { signOutAction, updateProfileAction } from '@/lib/auth/actions';
import { Icon, Num } from './wathba-icons';
import { WathbaTabs, WathbaTabsContent } from './wathba-tabs';

type TabId = 'profile' | 'addresses' | 'language' | 'security' | 'notifications';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'profile',       label: 'الملف الشخصي',  icon: 'person' },
  { id: 'addresses',     label: 'العناوين',       icon: 'category' },
  { id: 'language',      label: 'اللغة والمظهر',  icon: 'palette' },
  { id: 'security',      label: 'الأمان',          icon: 'shield' },
  { id: 'notifications', label: 'الإشعارات',      icon: 'notifications' },
];

export function WathbaSettings({
  me,
  okFlag,
  errFlag,
}: {
  me?: ApiUserMe | null;
  okFlag?: string | null;
  errFlag?: string | null;
}) {
  const [tab, setTab] = useState<TabId>('profile');

  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 26px 0' }}>
        <Num style={{ display: 'block', fontSize: 12, letterSpacing: 2, color: 'var(--accent)', marginBottom: 8 }}>
          SETTINGS · الإعدادات
        </Num>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px', marginBottom: 8 }}>
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
          <WathbaTabsContent value="security"><SecurityTab me={me} /></WathbaTabsContent>
          <WathbaTabsContent value="notifications"><NotificationsTab /></WathbaTabsContent>
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
          background: 'rgba(52,211,153,.10)', color: 'var(--pos)',
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
          ٣–٣٠ حرفاً لاتينياً أو رقماً أو (ـ . -). يظهر في رابط ملفك العام.
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
        <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
          لتغيير البريد، تواصل مع الدعم (support@wathba.sa).
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
        <Link href="/projects/me/pledges" style={{ color: 'var(--accent)' }}>«مكفوفاتي»</Link>.
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

function SecurityTab({ me }: { me?: ApiUserMe | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      <div style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 16, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>كلمة المرور</h2>
        <Row label="آخر تغيير لكلمة المرور" value={me ? new Date(me.createdAt).toLocaleDateString('ar-SA') : '—'}>
          <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
            (إعادة تعيين كلمة المرور من الإعدادات تأتي في تحديث قادم — اطلبها مؤقتاً عبر support@wathba.sa)
          </span>
        </Row>
      </div>

      <div style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 16, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>الجلسة الحالية</h2>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          أنت مسجَّل دخولك على هذا الجهاز. الجلسات محمية بـcookie آمنة، لا
          تنتهي إلا بعد ٧ أيام من آخر استخدام.
        </p>
        <form action={signOutAction}>
          <button type="submit" style={{
            background: 'transparent', border: '1px solid rgba(239,68,68,.30)',
            color: '#dc2626', fontFamily: 'inherit', fontWeight: 700,
            fontSize: 13, padding: '10px 18px', borderRadius: 11, cursor: 'pointer',
          }}>
            تسجيل الخروج من هذا الجهاز
          </button>
        </form>
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid rgba(var(--ink-rgb),.08)',
      borderRadius: 16, padding: 24, maxWidth: 640,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <h2 style={{ fontSize: 19, fontWeight: 700 }}>تفضيلات الإشعارات</h2>

      <ToggleRow label="إشعارات داخل التطبيق" hint="تظهر في صندوق الإشعارات أعلى الصفحة." defaultOn />
      <ToggleRow label="إشعارات بريد إلكتروني" hint="نجاح/فشل الحملات، تحديثات المشاريع، صرف المراحل." defaultOn />
      <ToggleRow label="رسائل SMS للحالات المهمة" hint="نجاح حملتك، صرف دفعة، تحقّق نفاذ." defaultOn={false} />

      <p style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6 }}>
        (واجهة عرض — حفظ التفضيلات يصل عند ربط نقاط نهاية notifications/me.)
      </p>
    </div>
  );
}

/* ────────────────────────────────── STAKES/S-4 identity fields ── */

/** C2 — avatar upload: presigned PUT to MinIO (kind:'avatar', ≤2MB) then the
 *  publicUrl rides the form in a hidden input; initials fallback otherwise. */
function AvatarField({ me }: { me?: ApiUserMe | null }) {
  const [url, setUrl] = useState<string | null>(me?.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pick = async (file: File) => {
    setErr(null);
    if (file.size > 2 * 1024 * 1024) { setErr('حجم الصورة يتجاوز ٢ ميغابايت.'); return; }
    setBusy(true);
    try {
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="الصورة الشخصية" width={64} height={64}
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
          {err ?? 'JPG / PNG / WebP — بحد أقصى ٢ ميغابايت.'}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

function ToggleRow({ label, hint, defaultOn }: { label: string; hint: string; defaultOn: boolean }) {
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
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        style={{
          position: 'relative', width: 46, height: 26, borderRadius: 20,
          border: 'none', cursor: 'pointer',
          background: on ? 'var(--grad)' : 'rgba(var(--ink-rgb),.15)',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
          background: 'var(--on-accent)',
          ...(on ? { right: 3 } : { left: 3 }),
          transition: 'all .2s',
        }} />
      </button>
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
};
