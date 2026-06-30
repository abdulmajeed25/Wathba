'use client';

import Link from 'next/link';
import { useState } from 'react';

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
      <h2 style={{ fontSize: 19, fontWeight: 700 }}>الملف الشخصي</h2>

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
          تعذّر حفظ التغييرات — حاول مجدداً.
        </div>
      )}

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
