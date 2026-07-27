'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { EmptyState } from './wathba-states';
import { Icon, Num } from './wathba-icons';
import type { ApiNotification, NotificationKind } from '@/lib/api/wathba';
import { formatSarFromHalalas } from '@/lib/i18n/format';

/**
 * Notifications inbox — Tier 2.6.
 *
 * Receives the page (items + unreadCount) from the server component above
 * (which calls /v1/notifications/me via the SDK with the bearer cookie).
 * Mark-read mutations go through the /api/notifications/* proxies; on
 * success we router.refresh() so the SSR re-fetches.
 *
 * If items is empty AND the user is anon (no `me`), the upstream route
 * never reaches us — middleware redirects to /sign-in?next=/projects/notifications.
 */

const ICON_FOR: Record<
  NotificationKind,
  { icon: string; color: string; bg: string }
> = {
  PLEDGE_RECEIVED:    { icon: 'favorite',         color: 'var(--accent-ink)', bg: 'rgba(var(--accent-rgb),.10)' },
  PROJECT_FUNDED:     { icon: 'rocket_launch',    color: 'var(--pos-ink)',    bg: 'rgba(var(--pos-rgb),.10)' },
  PROJECT_FAILED:     { icon: 'sentiment_dissatisfied', color: 'var(--err, #dc2626)', bg: 'rgba(var(--err-rgb), .10)' },
  MILESTONE_APPROVED: { icon: 'flag',             color: 'var(--accent-ink)', bg: 'rgba(var(--accent-rgb),.10)' },
  REFUND_COMPLETED:   { icon: 'currency_exchange', color: 'var(--blue)',  bg: 'rgba(var(--blue-rgb),.10)' },
  PAYOUT_SENT:        { icon: 'payments',         color: 'var(--accent-ink)', bg: 'rgba(var(--accent-rgb),.10)' },
  UPDATE_POSTED:      { icon: 'campaign',         color: 'var(--blue)',   bg: 'rgba(var(--blue-rgb),.10)' },
  CREATOR_NEW_PROJECT:{ icon: 'rocket_launch',    color: 'var(--accent-ink)', bg: 'rgba(var(--accent-rgb),.10)' },
  RANK_UP:            { icon: 'military_tech',    color: 'var(--gold-ink)',   bg: 'rgba(var(--gold-rgb),.10)' },
  CONTEST_OPENED:     { icon: 'celebration',      color: 'var(--purple)', bg: 'rgba(var(--purple-rgb),.10)' },
  CONTEST_ANNOUNCED:  { icon: 'emoji_events',     color: 'var(--gold-ink)',   bg: 'rgba(var(--gold-rgb),.10)' },
  FAQ_ANSWERED:       { icon: 'help_outline',     color: 'var(--blue)',   bg: 'rgba(var(--blue-rgb),.10)' },
  COMMENT_REPLY:      { icon: 'forum',            color: 'var(--accent-ink)', bg: 'rgba(var(--accent-rgb),.10)' },
};

interface DerivedLine {
  title: string;
  body: string;
  href?: string;
  /** STAKES/S-11 F-18 (C10) — the acting user, linked to /u/[handle]. */
  actor?: { name: string; handle: string | null };
}

function derive(n: ApiNotification): DerivedLine {
  // The payload shape varies by kind; fall back to a generic line if the
  // expected keys aren't there. Keep it lossy-but-safe.
  const p = (n.payload ?? {}) as Record<string, unknown>;
  const proj = typeof p.projectTitleAr === 'string' ? p.projectTitleAr : null;
  const projectId = typeof p.projectId === 'string' ? p.projectId : null;
  const updateId = typeof p.updateId === 'string' ? p.updateId : null;
  const commentId = typeof p.commentId === 'string' ? p.commentId : null;
  const round = typeof p.roundNum === 'number' ? p.roundNum : null;
  switch (n.kind) {
    case 'PLEDGE_RECEIVED':
      return {
        title: proj ? `وصل دعم جديد — ${proj}` : 'وصل دعم جديد',
        body: 'شكراً للداعمين. يمكنك متابعة التفاصيل من لوحة تحكّمك.',
        href: projectId ? `/projects/dashboard/${projectId}` : undefined,
      };
    case 'PROJECT_FUNDED':
      return {
        title: proj ? `نجح ${proj}! 🎉` : 'نجح المشروع 🎉',
        body: 'وصل المشروع إلى الهدف. سيُسحب التمويل تباعًا حسب المراحل.',
        href: projectId ? `/projects/${projectId}` : undefined,
      };
    case 'PROJECT_FAILED':
      return {
        title: proj ? `لم يصل ${proj} للهدف` : 'لم يصل المشروع للهدف',
        body: 'سيُسترد دعمك خلال أيام قليلة. شكراً للمحاولة.',
        href: projectId ? `/projects/${projectId}` : undefined,
      };
    case 'MILESTONE_APPROVED':
      return {
        title: proj ? `صرف مرحلة جديدة — ${proj}` : 'صرف مرحلة جديدة',
        body: 'اطّلع على الإيصالات في تبويب الشفافية.',
        href: projectId ? `/projects/${projectId}/transparency` : undefined,
      };
    case 'REFUND_COMPLETED': {
      // STAKES/S-12 F-08 — "your money is back" (amount in the payload).
      const amt = typeof p.amountHalalas === 'number' ? p.amountHalalas : null;
      return {
        title: proj ? `أُعيد مبلغك من ${proj}` : 'أُعيد مبلغك',
        body: amt !== null
          ? `أُعيد إليك ${formatSarFromHalalas('ar', amt)} — قد يستغرق ظهوره في حسابك بضعة أيام.`
          : 'قد يستغرق ظهوره في حسابك بضعة أيام حسب مصرفك.',
        href: '/projects/me/pledges',
      };
    }
    case 'PAYOUT_SENT':
      return {
        title: 'تم إرسال دفعة لمحفظتك',
        body: 'تحقّق من سجلّ المدفوعات لمعرفة التفاصيل.',
        href: '/projects/payments',
      };
    case 'UPDATE_POSTED':
      return {
        title: proj ? `تحديث جديد من ${proj}` : 'تحديث جديد',
        body: 'افتح المشروع لقراءة التحديث كاملاً.',
        href: projectId && updateId ? `/projects/${projectId}/updates/${updateId}` : (projectId ? `/projects/${projectId}/updates` : undefined),
      };
    case 'RANK_UP':
      return {
        title: 'وصلت لرتبة جديدة 🏅',
        body: 'تابع رتبتك في صفحة رتب الداعمين.',
        href: '/projects/ranks',
      };
    case 'CREATOR_NEW_PROJECT': {
      // STAKES/S-11 F-05 — the follow loop's payoff line.
      const creator = typeof p.creatorName === 'string' ? p.creatorName : null;
      const deepLink = typeof p.deepLink === 'string' ? p.deepLink : undefined;
      return {
        title: creator ? `${creator} أطلق مشروعاً جديداً` : 'مشروع جديد ممن تتابعه',
        body: proj ? `«${proj}» انطلق للتو — كن من أوائل الداعمين.` : 'افتح المشروع الجديد.',
        href: deepLink ?? (projectId ? `/projects/${projectId}` : undefined),
      };
    }
    case 'CONTEST_OPENED':
      return {
        title: proj ? `جولة جديدة من «علّق واربح» — ${proj}` : 'جولة جديدة من «علّق واربح»',
        body: round ? `الجولة رقم ${round} مفتوحة الآن.` : 'افتح المشروع للمشاركة.',
        href: projectId ? `/projects/${projectId}/comments` : undefined,
      };
    case 'CONTEST_ANNOUNCED':
      return {
        title: proj ? `أُعلنت نتائج «علّق واربح» — ${proj}` : 'أُعلنت نتائج «علّق واربح»',
        body: round ? `اطّلع على فائزي الجولة ${round}.` : 'اطّلع على الفائزين.',
        href: projectId ? `/projects/${projectId}/comments` : undefined,
      };
    case 'FAQ_ANSWERED':
      return {
        title: 'وصل ردّ على سؤالك',
        body: 'اطّلع على الإجابة في صفحة المشروع.',
        href: projectId ? `/projects/${projectId}/faqs` : undefined,
      };
    case 'COMMENT_REPLY': {
      const byName = typeof p.byName === 'string' ? p.byName : null;
      const byHandle = typeof p.byHandle === 'string' ? p.byHandle : null;
      return {
        title: byName ? `ردّ ${byName} على تعليقك` : 'ردّ جديد على تعليقك',
        body: 'افتح المشروع لقراءة الردّ.',
        href: projectId && commentId ? `/projects/${projectId}/comments` : undefined,
        ...(byName ? { actor: { name: byName, handle: byHandle } } : {}),
      };
    }
    default:
      return { title: 'إشعار جديد', body: '' };
  }
}

function formatRelativeAr(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.round(ms / 60_000);
    if (m < 1) return 'الآن';
    if (m < 60) return `قبل ${m} دقيقة`;
    const h = Math.round(m / 60);
    if (h < 24) return `قبل ${h} ساعة`;
    const d = Math.round(h / 24);
    if (d < 7) return `قبل ${d} يوم`;
    return new Date(iso).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function WathbaNotifications({
  items,
  unreadCount,
}: {
  items: ApiNotification[];
  unreadCount: number;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const markRead = (id: string): void => {
    startTransition(async () => {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      router.refresh();
    });
  };
  const markAllRead = (): void => {
    startTransition(async () => {
      await fetch(`/api/notifications/me/read-all`, { method: 'POST' });
      router.refresh();
    });
  };

  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '48px 26px 80px' }}>
        <Num style={{ display: 'block', fontSize: 12, letterSpacing: 2, color: 'var(--accent-ink)', marginBottom: 8 }}>
          NOTIFICATIONS · صندوق الإشعارات
        </Num>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px' }}>الإشعارات</h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 20,
                  background: 'rgba(var(--accent-rgb),.10)',
                  color: 'var(--accent-ink)',
                  border: '1px solid rgba(var(--accent-rgb),.30)',
                }}
              >
                {unreadCount} غير مقروء
              </span>
            )}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={pending}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 11,
                  background: 'transparent',
                  border: '1px solid rgba(var(--ink-rgb),.16)',
                  color: 'var(--text)',
                  cursor: pending ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: pending ? 0.6 : 1,
                }}
              >
                تعليم الكل كمقروء
              </button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon="notifications"
            title="لا توجد إشعارات بعد"
            body="ستظهر هنا تحديثات المشاريع التي دعمتها، مراحل الصرف، وحالة حسابك."
          />
        ) : (
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((n) => {
              const styling = ICON_FOR[n.kind] ?? ICON_FOR.UPDATE_POSTED;
              const read = !!n.readAt;
              const line = derive(n);
              const card = (
                <article
                  key={n.id}
                  style={{
                    background: read ? 'var(--card)' : 'rgba(var(--accent-rgb),.04)',
                    border: `1px solid ${read ? 'rgba(var(--ink-rgb),.08)' : 'rgba(var(--accent-rgb),.18)'}`,
                    borderRadius: 14,
                    padding: 18,
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    textDecoration: 'none',
                    color: 'inherit',
                    cursor: line.href ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (!read) markRead(n.id);
                    // Actor cards aren't Link-wrapped (nested <a>) — navigate here.
                    if (line.actor && line.href) router.push(line.href);
                  }}
                >
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 11,
                      background: styling.bg,
                      color: styling.color,
                      display: 'grid', placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={styling.icon} size={20} color={styling.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700 }}>{line.title}</h3>
                      <Num style={{ fontSize: 11.5, color: 'var(--muted2)', flexShrink: 0 }}>
                        {formatRelativeAr(n.createdAt)}
                      </Num>
                    </div>
                    {line.body && (
                      <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>{line.body}</p>
                    )}
                    {line.actor && (
                      /* Actor chip → public profile. Cards with an actor are
                         NOT wrapped in an outer Link (nested <a> is invalid),
                         so this is a real link and the card click navigates. */
                      <Link
                        href={`/u/${encodeURIComponent(line.actor.handle ?? line.actor.name)}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'inline-block', marginTop: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--accent-ink)', textDecoration: 'none' }}
                      >
                        ملف {line.actor.name} ←
                      </Link>
                    )}
                  </div>
                  {!read && (
                    <span
                      aria-hidden
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--accent)',
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    />
                  )}
                </article>
              );
              return line.href && !line.actor ? (
                <Link key={n.id} href={line.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {card}
                </Link>
              ) : (
                card
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
