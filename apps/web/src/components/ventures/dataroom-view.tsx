'use client';

import { useState } from 'react';

import { formatDate } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/config';
import { type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import { getDataroomAccessLog, getDataroomDocs } from '@/lib/ventures/fixtures';
import type { VentureSummary } from '@/lib/ventures/types';

type Dict = DictionaryShapes['ventures'];

export function DataroomView({
  locale,
  dict,
  venture,
}: {
  locale: Locale;
  dict: Dict;
  venture: VentureSummary;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const docs = getDataroomDocs(venture.id);
  const log = getDataroomAccessLog(venture.id);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-fg-faint">{venture.name}</span>
        <h1 className="text-h1 font-semibold text-fg">{dict.dataroom.title}</h1>
        <p className="text-sm text-fg-muted">{dict.dataroom.subtitle}</p>
        <button
          type="button"
          onClick={() => setAcknowledged(true)}
          disabled={acknowledged}
          className="self-start rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:bg-elevated disabled:text-fg-muted"
        >
          {acknowledged ? dict.dataroom.ndaAcknowledged : dict.dataroom.ndaPending}
        </button>
      </header>

      {!acknowledged ? (
        <p className="rounded-xl border border-warning/40 bg-warning/5 p-5 text-sm text-fg">
          {dict.dataroom.subtitle}
        </p>
      ) : docs.length === 0 ? (
        <p className="rounded-xl border border-edge bg-elevated p-9 text-center text-sm text-fg-muted">
          {dict.dataroom.noDocs}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-elevated p-4"
            >
              <div className="flex flex-col">
                <span className="text-body font-medium text-fg">{doc.title}</span>
                <span className="text-xs text-fg-muted">
                  {formatDate(locale, doc.uploadedAt, 'medium')} · {doc.sizeKb} KB
                </span>
              </div>
              <button
                type="button"
                className="rounded-md border border-edge px-4 py-1.5 text-sm text-fg transition-colors hover:border-edge-strong"
              >
                {dict.dataroom.openDoc}
              </button>
            </li>
          ))}
        </ul>
      )}

      {log.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-h3 font-semibold text-fg">{dict.dataroom.accessLogHeading}</h2>
          <ul className="flex flex-col gap-2">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-edge bg-elevated p-4"
              >
                <span className="text-sm text-fg">
                  {entry.viewerHandle} · {entry.docTitle}
                </span>
                <span className="text-xs text-fg-faint">
                  {formatDate(locale, entry.occurredAt, 'medium')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
