import type { ApiAnalytics, ApiFollowerRow } from '@/lib/api/wathba';

/**
 * Creator analytics (Creator-CC / CC-16) + follower roster (CC-17). Purely
 * presentational — the page server-fetches the data. Charts are inline SVG/CSS
 * (self-contained, no chart library). Everything shown is derived from real
 * pledge data; untracked dimensions are stated honestly.
 */
const fmtSAR = (h: number): string => `${(h / 100).toLocaleString('en-US')} ر.س`;

export function WathbaDashboardAnalytics({
  analytics,
  followers,
}: {
  analytics: ApiAnalytics | null;
  followers: { total: number; items: ApiFollowerRow[] } | null;
}): React.ReactElement {
  if (!analytics) {
    return (
      <StateCard>تعذّر تحميل التحليلات. حدّث الصفحة أو حاول لاحقاً.</StateCard>
    );
  }
  const { totals, pledgesOverTime, tierPerformance, updateEngagement } = analytics;
  const maxDay = Math.max(1, ...pledgesOverTime.map((d) => d.count));
  const maxTier = Math.max(1, ...tierPerformance.map((t) => t.amountHalalas));

  return (
    <>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>التحليلات</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          أرقام حملتك مشتقّة من بيانات الدعم الفعلية. (مصادر الزيارات والإحالات تتطلّب تتبّعاً
          غير مفعّل بعد.)
        </p>
      </header>

      {/* totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label="نسبة التمويل" value={`${totals.percentFunded}%`} accent />
        <Stat label="المبلغ المجموع" value={fmtSAR(totals.raisedHalalas)} />
        <Stat label="عدد الداعمين" value={totals.backersCount.toLocaleString('ar-SA')} />
        <Stat label="متوسّط الدعم" value={fmtSAR(totals.avgPledgeHalalas)} />
      </div>

      {/* pledges over time */}
      <Card title="الدعم عبر الزمن">
        {pledgesOverTime.length === 0 ? (
          <Empty>لا توجد تعهّدات بعد.</Empty>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, overflowX: 'auto', paddingTop: 8 }}>
            {pledgesOverTime.map((d) => (
              <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 34 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary, #5d6b62)' }}>{d.count}</span>
                <div
                  title={`${d.date}: ${d.count} تعهّد · ${fmtSAR(d.amountHalalas)}`}
                  style={{
                    width: 22, height: Math.round((d.count / maxDay) * 120) + 4, borderRadius: 6,
                    background: 'linear-gradient(180deg, #0bd47f, #05a661)',
                  }}
                />
                <span style={{ fontSize: 9.5, color: 'var(--text-tertiary, #5d6b62)', whiteSpace: 'nowrap' }}>
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* tier performance */}
      <Card title="أداء المكافآت">
        {tierPerformance.length === 0 ? (
          <Empty>لا توجد مكافآت مدعومة بعد.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tierPerformance.map((t) => (
              <div key={t.tierId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{t.titleAr}</span>
                  <span style={{ color: 'var(--text-secondary, #3b4942)' }}>
                    {t.backers} داعم · {fmtSAR(t.amountHalalas)}
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 6, background: 'rgba(18,33,26,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((t.amountHalalas / maxTier) * 100)}%`, height: '100%', background: 'var(--brand-primary, #05a661)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* engagement + followers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Card title="تفاعل التحديثات">
          <div style={{ display: 'flex', gap: 24, fontSize: 14 }}>
            <span>📣 {updateEngagement.updates} تحديث</span>
            <span>❤ {updateEngagement.likes} إعجاب</span>
            <span>💬 {updateEngagement.comments} تعليق</span>
          </div>
        </Card>
        <Card title={`المتابعون (${followers?.total ?? 0})`}>
          {!followers || followers.items.length === 0 ? (
            <Empty>لا يوجد متابعون بعد.</Empty>
          ) : (
            <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13.5, lineHeight: 1.9 }}>
              {followers.items.slice(0, 8).map((f) => (
                <li key={f.followerId}>
                  {f.name}{' '}
                  <span style={{ color: 'var(--text-tertiary, #5d6b62)', fontSize: 12 }}>
                    — {new Date(f.followedAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): React.ReactElement {
  return (
    <div
      style={{
        padding: '14px 16px', borderRadius: 12,
        background: accent ? 'rgba(5,166,97,0.08)' : 'var(--bg-elevated, #fff)',
        border: `1px solid ${accent ? 'rgba(5,166,97,0.3)' : 'var(--border-subtle, rgba(18,33,26,0.08))'}`,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-tertiary, #5d6b62)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ? 'var(--brand-primary, #05a661)' : 'var(--text-primary, #16201b)' }}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div style={{ fontSize: 13.5, color: 'var(--text-tertiary, #5d6b62)' }}>{children}</div>;
}

function StateCard({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ padding: 24, borderRadius: 12, textAlign: 'center', fontSize: 14, background: 'var(--bg-elevated, #fff)', border: '1px dashed rgba(239,68,68,0.4)', color: '#ef4444' }}>
      {children}
    </div>
  );
}
