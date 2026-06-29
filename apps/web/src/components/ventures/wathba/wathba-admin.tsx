'use client';

import { useState } from 'react';

import { deriveProject, wathbaProjects } from './wathba-data';
import { Icon, Num } from './wathba-icons';
import { WathbaTabs, WathbaTabsContent } from './wathba-tabs';

/**
 * §7 admin surface — minimal partner-management view. Lets an admin see every
 * project and toggle its `platformPartner` flag with a disclosure note. Wires
 * to `PUT /v1/admin/projects/:id/platform-partner` on the API (UI-only here;
 * the API mutation goes through the bearer cookie when ADMIN-role auth lands).
 */
type TabId = 'review' | 'partners' | 'kyc' | 'payouts';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'review',   label: 'مراجعة المشاريع', icon: 'inbox' },
  { id: 'partners', label: 'إدارة الشراكات',   icon: 'verified' },
  { id: 'kyc',      label: 'التحقق من الهويات', icon: 'shield' },
  { id: 'payouts',  label: 'الصرف والتدفقات',   icon: 'credit_card' },
];

export function WathbaAdmin() {
  const [tab, setTab] = useState<TabId>('partners');
  const projects = wathbaProjects.map(deriveProject);

  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '48px 26px 0' }}>
        <Num style={{ fontSize: 12, letterSpacing: 2, color: 'var(--accent)', display: 'block', marginBottom: 8 }}>
          ADMIN CONSOLE · لوحة الإدارة
        </Num>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px', marginBottom: 8 }}>
          الإدارة
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-soft)', maxWidth: 720, lineHeight: 1.6 }}>
          مراجعة المشاريع المُرسلة، إدارة شراكات وثبة (§7)، التحقق من الهويات،
          ومتابعة عمليات الصرف. الإجراءات هنا تستدعي مسارات الإدارة في الـAPI.
        </p>
      </section>

      <WathbaTabs tabs={TABS} value={tab} onValueChange={(v) => setTab(v as TabId)} maxWidth={1160}>
        <section style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 26px 80px' }}>
          <WathbaTabsContent value="partners">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  background: 'rgba(var(--purple-rgb),.07)',
                  border: '1px solid rgba(var(--purple-rgb),.30)',
                  borderRadius: 14,
                  padding: 18,
                  display: 'flex',
                  gap: 12,
                }}
              >
                <Icon name="info" size={20} color="var(--purple)" />
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-soft)' }}>
                  وسم «بشراكة وثبة» يجب أن يكون مرئياً للداعمين على بطاقة المشروع
                  وفي صفحة التفاصيل. هذا التزام شفافية إلزامي (§7). نص الإفصاح
                  مطلوب أن يكون ≥٢٠ حرفاً ويوضّح طبيعة الشراكة.
                </p>
              </div>
              {projects.map((p) => {
                const partnered = p.platformPartner != null;
                return (
                  <PartnerRow key={p.id} title={p.titleAr} creator={p.creator} partnered={partnered} />
                );
              })}
            </div>
          </WathbaTabsContent>

          <WathbaTabsContent value="review">
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              قائمة مراجعة المشاريع تأتي مع ربط مسار `/v1/admin/review-queue` —
              (متاحة في الـAPI، يُربط هنا عند توفّر مصادقة الدور ADMIN في الواجهة).
            </p>
          </WathbaTabsContent>
          <WathbaTabsContent value="kyc">
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              طابور تحقّق نفاذ — `/v1/admin/kyc-queue` متاح، الربط مرتبط بدور ADMIN.
            </p>
          </WathbaTabsContent>
          <WathbaTabsContent value="payouts">
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              تتبّع الصرف عبر مراحل المشاريع. ربط `/v1/payouts` قيد الوصول.
            </p>
          </WathbaTabsContent>
        </section>
      </WathbaTabs>
    </div>
  );
}

function PartnerRow({
  title,
  creator,
  partnered,
}: {
  title: string;
  creator: string;
  partnered: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        className="wathba-ph"
        style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>بواسطة {creator}</div>
      </div>
      <button
        type="button"
        style={{
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '8px 14px',
          borderRadius: 11,
          fontSize: 12,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: partnered ? 'rgba(var(--purple-rgb),.13)' : 'rgba(var(--ink-rgb),.06)',
          border: `1px solid ${partnered ? 'rgba(var(--purple-rgb),.47)' : 'transparent'}`,
          color: partnered ? 'var(--purple)' : 'var(--muted)',
        }}
      >
        {partnered && <Icon name="verified" size={13} color="var(--purple)" />}
        {partnered ? 'بشراكة وثبة ✓' : 'تعيين كشريك'}
      </button>
    </div>
  );
}
