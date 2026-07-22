import { arInt, fmtPct, pctIntent, intentText, intentFill } from '../_lib/labels';

/**
 * OPS-360 Unit 5 — the acquisition→activation funnel as a horizontal bar
 * cascade. Each stage's bar width is proportional to its count against the
 * widest stage (signups); between two stages we show the RETENTION % (the
 * survivor share) so the drop-off reads at a glance. No chart library: inline
 * styled divs only, so nothing leaks into the public bundle.
 *
 * `visits` (top-of-funnel) is honestly null — the platform has no analytics
 * pixel — so it renders «بيانات غير متوفرة» with the API's own note, never a 0.
 */

export interface FunnelStage {
  key: string;
  label: string;
  value: number | null;
  /** Retention % from the PREVIOUS stage to this one (null when unmeasurable). */
  retentionPct?: number | null;
}

export function Funnel({
  stages,
  topNote,
}: {
  stages: FunnelStage[];
  topNote: string;
}) {
  const measured = stages.filter((s) => typeof s.value === 'number') as Array<
    FunnelStage & { value: number }
  >;
  const max = measured.reduce((m, s) => Math.max(m, s.value), 0);

  return (
    <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
      {/* Honest top-of-funnel: visits are not tracked. */}
      <div className="mb-4 rounded-lg border border-dashed border-[#30363d] bg-[#0d1117] p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#c9d1d9]">الزيارات (أعلى القمع)</span>
          <span title={topNote} className="text-xs font-bold text-[#484f58]">
            بيانات غير متوفرة
          </span>
        </div>
        <p className="mt-1 text-[10px] text-[#484f58]">{topNote}</p>
      </div>

      <div className="space-y-4">
        {stages.map((s, i) => {
          const width =
            typeof s.value === 'number' && max > 0
              ? Math.max(3, Math.min(100, (s.value / max) * 100))
              : 0;
          const ret = s.retentionPct;
          const retIntent = pctIntent(ret ?? null, 'higher');
          return (
            <div key={s.key}>
              {i > 0 ? (
                <div className="mb-1 flex items-center gap-2 ps-1 text-[10px]">
                  <span aria-hidden className="text-[#484f58]">↳</span>
                  {typeof ret === 'number' ? (
                    <span className={intentText(retIntent)}>
                      انتقل {fmtPct(ret)} من المرحلة السابقة
                    </span>
                  ) : (
                    <span className="text-[#484f58]">نسبة الانتقال غير متاحة</span>
                  )}
                </div>
              ) : null}
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-xs text-[#c9d1d9]">{s.label}</div>
                <div className="h-6 flex-1 overflow-hidden rounded bg-[#0d1117]">
                  {typeof s.value === 'number' ? (
                    <div
                      className={`flex h-full items-center rounded ${intentFill('default')}`}
                      style={{ width: `${width}%` }}
                    >
                      <span className="px-2 text-[11px] font-bold tabular-nums text-[#e6edf3]">
                        {arInt(s.value)}
                      </span>
                    </div>
                  ) : (
                    <span className="flex h-full items-center px-2 text-[11px] text-[#484f58]">
                      غير متاح
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
