import type { Locale } from '@/lib/i18n/config';
import { type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import { getCaptable } from '@/lib/ventures/fixtures';
import type { VentureSummary } from '@/lib/ventures/types';

type Dict = DictionaryShapes['ventures'];

export function CaptableView({
  dict,
  venture,
}: {
  locale: Locale;
  dict: Dict;
  venture: VentureSummary;
}) {
  const rows = getCaptable(venture.id);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-fg-faint">{venture.name}</span>
        <h1 className="text-h1 font-semibold text-fg">{dict.captable.title}</h1>
        <p className="text-sm text-fg-muted">{dict.captable.subtitle}</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-edge bg-elevated p-9 text-center text-sm text-fg-muted">
          {dict.captable.noCaptable}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge bg-elevated">
          <table className="w-full text-sm">
            <thead className="border-b border-edge text-xs uppercase tracking-widest text-fg-faint">
              <tr>
                <th className="px-4 py-3 text-start">{dict.captable.shareholderHeading}</th>
                <th className="px-4 py-3 text-end">{dict.captable.sharesHeading}</th>
                <th className="px-4 py-3 text-end">{dict.captable.percentHeading}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.shareholderHandle}
                  className={`border-b border-edge last:border-b-0 ${
                    row.isSelf ? 'bg-brand/5' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-fg">
                    {row.isSelf ? dict.captable.youLabel : row.shareholderDisplayName}
                  </td>
                  <td className="px-4 py-2 text-end text-fg" dir="ltr">
                    {row.shares.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-end text-fg" dir="ltr">
                    {row.pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
