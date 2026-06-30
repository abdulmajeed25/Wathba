import type { ApiContest } from '@/lib/api/wathba';
import { Icon } from './wathba-icons';

/**
 * Public-facing banner for the comments tab.
 *
 * Shows the most recently-OPEN round (active call-to-action), plus a ribbon
 * for the most-recent ANNOUNCED round (so winners stay visible for a beat
 * after the round closes).
 *
 * Renders nothing when the project has no contests yet.
 */
export function ContestsBanner({
  contests,
}: {
  contests: ApiContest[];
}): React.ReactElement | null {
  const open = [...contests]
    .filter((c) => c.status === 'OPEN')
    .sort((a, b) => b.roundNum - a.roundNum)[0];
  const announced = [...contests]
    .filter((c) => c.status === 'ANNOUNCED')
    .sort((a, b) => b.roundNum - a.roundNum)[0];

  if (!open && !announced) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      {open && <OpenBanner contest={open} />}
      {announced && <AnnouncedRibbon contest={announced} />}
    </div>
  );
}

function OpenBanner({ contest }: { contest: ApiContest }): React.ReactElement {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(5,166,97,0.10), rgba(99,102,241,0.08))',
        border: '1px solid rgba(5,166,97,0.30)',
        borderRadius: 16,
        padding: 18,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--brand-primary, #05a661)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="celebration" size={22} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: 'inline-block',
            background: 'var(--brand-primary, #05a661)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          الجولة {contest.roundNum} — مفتوحة الآن
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{contest.promptAr}</div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary, #3b4942)',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>
            🎁 {prizeLabel(contest)} ({contest.winnersCount}{' '}
            {contest.winnersCount === 1 ? 'فائز' : 'فائزين'})
          </span>
          {contest.endsAt && (
            <span>تنتهي: {new Date(contest.endsAt).toLocaleDateString('ar-SA')}</span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--brand-primary, #05a661)',
            marginTop: 10,
          }}
        >
          اشترك بالتعليق على المنشور لتربح ↓
        </div>
      </div>
    </div>
  );
}

function AnnouncedRibbon({ contest }: { contest: ApiContest }): React.ReactElement {
  const nums = contest.winners
    .map((w) => w.backerNo)
    .sort((a, b) => a - b)
    .map((n) => `#${n}`)
    .join('، ');
  return (
    <div
      style={{
        background: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.30)',
        borderRadius: 14,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
      }}
    >
      <span style={{ fontSize: 20 }}>🎉</span>
      <div>
        <strong>فائزو الجولة {contest.roundNum}:</strong>{' '}
        <span style={{ color: 'var(--text-secondary, #3b4942)' }}>الداعمون {nums}</span>
      </div>
    </div>
  );
}

function prizeLabel(c: ApiContest): string {
  if (c.prizeCustomAr) return c.prizeCustomAr;
  if (c.prizeRewardTierId) return 'مكافأة من الحملة';
  if (c.prizeAddOnId) return 'إضافة';
  return 'جائزة';
}
