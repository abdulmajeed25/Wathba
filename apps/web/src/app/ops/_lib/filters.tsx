import type { ReactNode } from 'react';

/**
 * OPS Part 5 — the server-first filter toolkit, mirroring «سجل التدقيق»'s
 * plain GET form (zero client JS). Screens declare fields; <FilterForm>
 * renders a `method="get"` form whose submit rewrites the querystring. Values
 * are seeded from the current searchParams so filters survive navigation, and
 * a hidden-field mechanism preserves params the form doesn't own (e.g. a
 * sort) — but NOT the cursor (a new filter must restart pagination).
 */

export type FilterField =
  | { kind: 'text'; name: string; placeholderAr?: string; labelAr?: string }
  | { kind: 'date'; name: string; labelAr?: string }
  | {
      kind: 'select';
      name: string;
      labelAr?: string;
      /** First option is the "all" default (empty value). */
      options: Array<{ value: string; labelAr: string }>;
      allLabelAr?: string;
    };

/** Build a `?a=1&b=2` string, dropping empty values. Order-stable. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

const INPUT =
  'rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm outline-none focus:border-emerald-500';

export function FilterForm({
  fields,
  values,
  preserve = {},
  action,
  submitLabelAr = 'تصفية',
  children,
}: {
  fields: FilterField[];
  /** Current searchParams (defaultValues); typically the page's `sp`. */
  values: Record<string, string | undefined>;
  /** Extra hidden params to carry through (e.g. sort) — cursor excluded. */
  preserve?: Record<string, string | undefined>;
  /** Optional form action (defaults to same route). */
  action?: string;
  submitLabelAr?: string;
  /** Extra controls appended after the fields, before the submit button. */
  children?: ReactNode;
}) {
  return (
    <form
      method="get"
      action={action}
      className="grid gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {Object.entries(preserve).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      {fields.map((f) => {
        const v = values[f.name] ?? '';
        if (f.kind === 'select') {
          return (
            <label key={f.name} className="contents">
              {f.labelAr ? <span className="sr-only">{f.labelAr}</span> : null}
              <select name={f.name} defaultValue={v} aria-label={f.labelAr ?? f.name} className={INPUT}>
                <option value="">{f.allLabelAr ?? 'الكل'}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.labelAr}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        const placeholderAr = f.kind === 'text' ? f.placeholderAr : undefined;
        return (
          <input
            key={f.name}
            name={f.name}
            type={f.kind === 'date' ? 'date' : 'text'}
            defaultValue={v}
            placeholder={placeholderAr}
            aria-label={f.labelAr ?? placeholderAr ?? f.name}
            className={INPUT}
          />
        );
      })}
      {children}
      <button
        type="submit"
        className="rounded bg-[#238636] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2ea043]"
      >
        {submitLabelAr}
      </button>
    </form>
  );
}
