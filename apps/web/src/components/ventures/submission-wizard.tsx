'use client';

import { useMemo, useState } from 'react';

import type { Locale } from '@/lib/i18n/config';
import { createTranslator, type DictionaryShapes } from '@/lib/i18n/get-dictionary';

type Dict = DictionaryShapes['ventures'];

const STEPS: readonly (keyof Dict['submit']['steps'])[] = [
  'basics',
  'sectors',
  'team',
  'businessCase',
  'milestones',
  'backing',
  'review',
];

const AI_FEEDBACK: Record<string, string> = {
  basics: 'Tighten the tagline to one sentence — strip adjectives.',
  sectors: 'Pick at most two primary sectors; secondary signals get noise.',
  team: 'Add the founder bio; backers read it first.',
  businessCase: 'Quantify the market — what does TAM look like in SAR?',
  milestones: 'Three milestones in 12 months is realistic; six is fragile.',
  backing: 'Equity + reward together is fine; recurring + soft is unusual.',
  review: 'Submission looks consistent. Vetting committee will review within 5–7 days.',
};

export function SubmissionWizard({ locale, dict }: { locale: Locale; dict: Dict }) {
  const t = useMemo(() => createTranslator(locale, 'ventures', dict), [locale, dict]);
  const [stepIdx, setStepIdx] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const stepKey = STEPS[stepIdx]!;
  const advance = () => {
    if (stepIdx === STEPS.length - 1) {
      setSubmitted(true);
      return;
    }
    setStepIdx((i) => i + 1);
  };

  if (submitted) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success/5 p-7 text-center">
        <h2 className="text-h2 font-semibold text-fg">{dict.submit.submitted}</h2>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold text-fg">{dict.submit.title}</h1>
        <p className="text-sm text-fg-muted">{dict.submit.subtitle}</p>
        <p className="text-xs text-fg-faint" dir="ltr">
          {t('submit.stepLabel', { n: stepIdx + 1, total: STEPS.length })} ·{' '}
          {dict.submit.steps[stepKey]}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-edge bg-elevated p-5">
          <h2 className="text-h3 font-semibold text-fg">{dict.submit.steps[stepKey]}</h2>
          <textarea
            rows={6}
            value={draft[stepKey] ?? ''}
            onChange={(event) => setDraft((prev) => ({ ...prev, [stepKey]: event.target.value }))}
            className="rounded-md border border-edge bg-base px-4 py-2 text-sm text-fg"
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-edge bg-elevated p-5">
          <h2 className="text-xs uppercase tracking-widest text-fg-faint">
            {dict.submit.aiFeedbackHeading}
          </h2>
          <p className="text-sm text-fg-muted">
            {(draft[stepKey] ?? '').trim().length > 0
              ? AI_FEEDBACK[stepKey]
              : dict.submit.aiFeedbackEmpty}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          className="rounded-md border border-edge px-5 py-2 text-sm text-fg transition-colors hover:border-edge-strong disabled:opacity-50"
        >
          {dict.back.previousCta}
        </button>
        <button
          type="button"
          onClick={advance}
          className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          {stepIdx === STEPS.length - 1 ? dict.submit.submitCta : dict.back.nextCta}
        </button>
      </div>
    </div>
  );
}
