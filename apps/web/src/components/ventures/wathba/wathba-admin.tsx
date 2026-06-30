'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Icon, Num } from './wathba-icons';
import { WathbaTabs, WathbaTabsContent } from './wathba-tabs';
import type { ApiKycRow, ApiProjectDetail } from '@/lib/api/wathba';

/**
 * §7 admin console — Tier 2.7 rewrite.
 *
 * Three tabs, all wired to real /v1/admin/* endpoints:
 *   - مراجعة: UNDER_REVIEW projects with approve / reject buttons
 *   - نفاذ: users awaiting Nafath verification with "force-verify" override
 *   - شراكات: existing platform-partner projects (read-only listing for now;
 *     the toggle on the project Settings page is the right place to flip)
 *
 * Mutations go through /api/admin/* browser proxies so the httpOnly bearer
 * cookie is exchanged for a server-side Authorization header (the API layer
 * enforces JwtAuthGuard + RolesGuard with @Roles('ADMIN')).
 */
type TabId = 'review' | 'kyc' | 'partners';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'review',   label: 'المراجعة',   icon: 'inbox' },
  { id: 'kyc',      label: 'التحقق من الهويات', icon: 'shield' },
  { id: 'partners', label: 'الشراكات',   icon: 'verified' },
];

export function WathbaAdmin({
  reviewQueue,
  kycQueue,
}: {
  reviewQueue: ApiProjectDetail[];
  kycQueue: ApiKycRow[];
}): React.ReactElement {
  const [tab, setTab] = useState<TabId>('review');

  const partners = reviewQueue.filter(
    (p) => p.platformPartner !== null && p.platformPartner !== undefined,
  );

  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '48px 26px 0' }}>
        <Num
          style={{
            fontSize: 12,
            letterSpacing: 2,
            color: 'var(--accent)',
            display: 'block',
            marginBottom: 8,
          }}
        >
          ADMIN CONSOLE · لوحة الإدارة
        </Num>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px', marginBottom: 8 }}>
          الإدارة
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-soft)', maxWidth: 720, lineHeight: 1.6 }}>
          مراجعة المشاريع المُرسلة، التحقّق من الهويات عبر نفاذ، ومتابعة شراكات
          وثبة (§7). كل إجراء يمرّ بمسار إدارة في الـAPI بدور ADMIN.
        </p>
      </section>

      <WathbaTabs
        tabs={TABS}
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        maxWidth={1160}
      >
        <section style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 26px 80px' }}>
          <WathbaTabsContent value="review">
            {reviewQueue.length === 0 ? (
              <Empty body="لا توجد مشاريع بانتظار المراجعة الآن." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {reviewQueue.map((p) => (
                  <ReviewRow key={p.id} project={p} />
                ))}
              </div>
            )}
          </WathbaTabsContent>

          <WathbaTabsContent value="kyc">
            {kycQueue.length === 0 ? (
              <Empty body="ما في طلبات تحقّق نفاذ معلّقة." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {kycQueue.map((u) => (
                  <KycRow key={u.id} user={u} />
                ))}
              </div>
            )}
          </WathbaTabsContent>

          <WathbaTabsContent value="partners">
            {partners.length === 0 ? (
              <Empty body="لا توجد مشاريع مع شراكة §7 الآن. يُحدَّد الوسم من إعدادات المشروع." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {partners.map((p) => (
                  <PartnerRow key={p.id} project={p} />
                ))}
              </div>
            )}
          </WathbaTabsContent>
        </section>
      </WathbaTabs>
    </div>
  );
}

function Empty({ body }: { body: string }): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px dashed rgba(var(--ink-rgb), .16)',
        borderRadius: 14,
        padding: 28,
        textAlign: 'center',
        color: 'var(--muted)',
        fontSize: 14,
      }}
    >
      {body}
    </div>
  );
}

function ReviewRow({ project }: { project: ApiProjectDetail }): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectInput, setRejectInput] = useState(false);
  const [reason, setReason] = useState('');

  const review = (decision: 'approve' | 'reject', rsn?: string): void => {
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/api/admin/projects/${project.id}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: rsn ?? '' }),
      });
      if (!r.ok) {
        const t = await r.text();
        try {
          const j = JSON.parse(t) as { message?: string };
          setError(j.message ?? 'فشل الإجراء');
        } catch {
          setError('فشل الإجراء');
        }
        return;
      }
      setRejectInput(false);
      setReason('');
      router.refresh();
    });
  };

  return (
    <article
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb), .08)',
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div
          className="wathba-ph"
          style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{project.titleAr}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
            {project.shortDescAr}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 14,
              fontSize: 12,
              color: 'var(--muted2)',
              marginTop: 8,
            }}
          >
            <span>الفئة: {project.category}</span>
            <span>الهدف: {(Number(project.fundingGoalHalalas) / 100).toLocaleString('ar-SA')} ر.س</span>
            <span>عتبة: {project.releaseThresholdPct}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => review('approve')}
            disabled={pending}
            style={btnPrimary(pending)}
          >
            <Icon name="check_circle" size={14} /> موافقة
          </button>
          <button
            type="button"
            onClick={() => setRejectInput((v) => !v)}
            disabled={pending}
            style={btnGhost(pending)}
          >
            <Icon name="cancel" size={14} /> رفض
          </button>
        </div>
      </div>
      {rejectInput && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            background: 'rgba(var(--err-rgb), 0.06)',
            border: '1px solid rgba(var(--err-rgb), 0.30)',
            borderRadius: 11,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 700 }}>سبب الرفض (يرسَل للمبدع)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="اكتب سبباً واضحاً يساعد المبدع على التعديل…"
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(var(--ink-rgb), .16)',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => review('reject', reason.trim())}
              disabled={pending || reason.trim().length < 5}
              style={btnDanger(pending || reason.trim().length < 5)}
            >
              إرسال الرفض
            </button>
          </div>
        </div>
      )}
      {error && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'var(--err, #dc2626)',
            background: 'rgba(var(--err-rgb), 0.08)',
            border: '1px solid rgba(var(--err-rgb), 0.30)',
            padding: '6px 10px',
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}
    </article>
  );
}

function KycRow({ user }: { user: ApiKycRow }): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const verify = (): void => {
    setError(null);
    startTransition(async () => {
      const r = await fetch(`/api/admin/users/${user.id}/force-verify`, { method: 'POST' });
      if (!r.ok) {
        setError('فشل التحقّق');
        return;
      }
      router.refresh();
    });
  };
  return (
    <article
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb), .08)',
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: '50%', background: 'rgba(var(--ink-rgb), .06)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <Icon name="person" size={20} color="var(--muted)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{user.name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user.email}</div>
      </div>
      <button type="button" onClick={verify} disabled={pending} style={btnPrimary(pending)}>
        <Icon name="verified_user" size={14} /> تحقّق يدوي
      </button>
      {error && (
        <span style={{ fontSize: 12, color: 'var(--err, #dc2626)' }}>{error}</span>
      )}
    </article>
  );
}

function PartnerRow({ project }: { project: ApiProjectDetail }): React.ReactElement {
  return (
    <article
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--purple-rgb), .30)',
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <Icon name="verified" size={22} color="var(--purple)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{project.titleAr}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>بشراكة وثبة §7</div>
      </div>
    </article>
  );
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--grad)',
    color: 'var(--on-accent)',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 12.5,
    padding: '8px 14px',
    borderRadius: 11,
    border: 'none',
    cursor: disabled ? 'wait' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    opacity: disabled ? 0.6 : 1,
  };
}

function btnGhost(disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid rgba(var(--ink-rgb), .16)',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 12.5,
    padding: '8px 14px',
    borderRadius: 11,
    cursor: disabled ? 'wait' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    opacity: disabled ? 0.6 : 1,
  };
}

function btnDanger(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--err, #dc2626)',
    color: '#fff',
    border: 'none',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 12.5,
    padding: '8px 14px',
    borderRadius: 11,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    opacity: disabled ? 0.5 : 1,
  };
}
