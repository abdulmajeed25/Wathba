import type { Locale } from '@/lib/i18n/config';
import { type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import type { VentureSummary } from '@/lib/ventures/types';

type Dict = DictionaryShapes['ventures'];

export function PostmortemView({
  dict,
  venture,
}: {
  locale: Locale;
  dict: Dict;
  venture: VentureSummary;
}) {
  const hasPostmortem = venture.state === 'closed';

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-fg-faint">{venture.name}</span>
        <h1 className="text-h1 font-semibold text-fg">{dict.postmortem.title}</h1>
        <p className="text-sm text-fg-muted">{dict.postmortem.subtitle}</p>
      </header>

      {!hasPostmortem ? (
        <p className="rounded-xl border border-edge bg-elevated p-9 text-center text-sm text-fg-muted">
          {dict.postmortem.noPostmortem}
        </p>
      ) : (
        <>
          <Section title={dict.postmortem.whatHappened} body={dict.postmortem.whatHappenedBody} />
          <Section title={dict.postmortem.finalLedger} body={dict.postmortem.finalLedgerBody} />
          <Section title={dict.postmortem.lessons} body={dict.postmortem.lessonsBody} />
        </>
      )}
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-edge bg-elevated p-5">
      <h2 className="text-h3 font-semibold text-fg">{title}</h2>
      <p className="text-sm text-fg-muted">{body}</p>
    </section>
  );
}
