import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

/** Batch CAT — discover loading skeleton (the 4th state: loading). */
export default function DiscoverLoading() {
  return (
    <WathbaShell>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 26px 60px' }}>
        <div
          className="wathba-ph"
          style={{ height: 20, width: 220, borderRadius: 8, marginBottom: 18 }}
          aria-hidden
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}
          aria-label="جارٍ التحميل"
          aria-busy="true"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="wathba-ph"
              style={{ height: 240, borderRadius: 18 }}
              aria-hidden
            />
          ))}
        </div>
      </div>
    </WathbaShell>
  );
}
