/**
 * Placeholder rendered by a dashboard section page until its owner slice
 * fills it in. Keeps the side-nav alive end-to-end while sub-slices land.
 */
export function SectionPlaceholder({
  title,
  intro,
  bullets,
}: {
  title: string;
  intro: string;
  bullets: readonly string[];
}): React.ReactElement {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          {intro}
        </p>
      </div>
      <div
        style={{
          padding: 20,
          background: 'var(--bg-elevated, #fff)',
          border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
          borderRadius: 12,
          fontSize: 14,
          color: 'var(--text-secondary, #3b4942)',
        }}
      >
        <div style={{ marginBottom: 12, fontWeight: 600 }}>قيد البناء — يصل هذا القسم قريباً:</div>
        <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.8 }}>
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
