/** Section-level loading skeleton (Sprint 3 / P0-203). Pure CSS pulse. */
export function WathbaLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="جارٍ التحميل"
      style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div className="wathba-ph" style={{ height: 34, width: '40%', borderRadius: 10 }} />
      <div className="wathba-ph" style={{ height: 16, width: '65%', borderRadius: 8 }} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="wathba-ph" style={{ height: 92, borderRadius: 14 }} />
      ))}
    </div>
  );
}
