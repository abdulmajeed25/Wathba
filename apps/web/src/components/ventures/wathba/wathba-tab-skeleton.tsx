/**
 * TABS — slim per-route loading skeleton shown in the content area while a
 * tab's payload streams in (the persistent header + tab bar stay in place).
 * Server component: zero JS.
 */
export function WathbaTabSkeleton() {
  return (
    <div aria-busy="true" aria-label="يُحمَّل" style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[92, 160, 160, 120].map((h, i) => (
        <div
          key={i}
          className="wathba-ph"
          style={{ height: h, borderRadius: 16, opacity: 1 - i * 0.18 }}
        />
      ))}
    </div>
  );
}
