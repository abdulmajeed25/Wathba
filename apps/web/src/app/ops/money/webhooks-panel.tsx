import { API_BASE } from '../_lib/guard';
import { qs } from '../_lib/filters';
import { StatusBadge } from '../_components/badge';
import { OpRunner } from '../_components/op-runner';

interface WebhookRow {
  id: string;
  provider: string;
  eventType: string;
  pspRef: string;
  outcome: string | null;
  processedAt: string | null;
  createdAt: string;
}

const OUTCOME_INTENT: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'muted'> = {
  applied: 'ok',
  ignored: 'muted',
  duplicate: 'info',
  mismatch: 'danger',
};

/**
 * OPS-360 Unit 3 — the WebhookEvent browser. Before this, webhooks.replay was
 * unreachable: the op needs a webhookEventId but nothing listed the stored
 * events. Now mismatch-outcome deliveries (the ones a replay heals) are
 * visible with a governed replay button per row.
 */
export async function WebhooksPanel({
  opsToken,
  cursor,
  outcome,
}: {
  opsToken: string;
  cursor?: string;
  outcome?: string;
}) {
  let rows: WebhookRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  try {
    const res = await fetch(`${API_BASE}/v1/ops/money/webhook-events${qs({ outcome, cursor, limit: '50' })}`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (res.status === 403) refused = true;
    else if (res.ok) {
      const b = (await res.json()) as { items: WebhookRow[]; nextCursor: string | null };
      rows = b.items;
      nextCursor = b.nextCursor;
    }
  } catch {
    /* tolerated */
  }

  if (refused) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض أحداث الويبهوك.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="tab" value="webhooks" />
          <select
            name="outcome"
            defaultValue={outcome ?? ''}
            className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
          >
            <option value="">كل النتائج</option>
            <option value="mismatch">تعارض (قابل لإعادة التشغيل)</option>
            <option value="applied">مُطبَّق</option>
            <option value="ignored">مُتجاهَل</option>
            <option value="duplicate">مكرّر</option>
          </select>
          <button className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d]">
            تصفية
          </button>
        </form>
        <p className="text-xs text-[#8b949e]">
          إعادة التشغيل تعيد تطبيق حدث مخزَّن على حالة التعهد الحالية — تعالج أحداث «التعارض» التي وصلت والحالة غير مناسبة.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">النوع</th>
              <th className="px-3 py-2 font-medium">المزوّد</th>
              <th className="px-3 py-2 font-medium">المرجع</th>
              <th className="px-3 py-2 font-medium">النتيجة</th>
              <th className="px-3 py-2 font-medium">التاريخ</th>
              <th className="px-3 py-2 font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#8b949e]">
                  لا أحداث مطابقة.
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">{e.eventType}</td>
                <td className="px-3 py-2 text-[#8b949e]">{e.provider}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-[#8b949e]" dir="ltr">{e.pspRef.slice(0, 16)}</td>
                <td className="px-3 py-2">
                  {e.outcome ? <StatusBadge intent={OUTCOME_INTENT[e.outcome] ?? 'muted'}>{e.outcome}</StatusBadge> : <span className="text-[#484f58]">—</span>}
                </td>
                <td className="px-3 py-2 text-[11px] text-[#8b949e]">
                  {new Date(e.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-3 py-2">
                  {e.provider === 'moyasar' && (
                    <OpRunner
                      opKey="webhooks.replay"
                      input={{ webhookEventId: e.id }}
                      triggerLabel="إعادة تشغيل"
                      riskTier="SENSITIVE"
                      requiresReason
                      variant={e.outcome === 'mismatch' ? 'danger' : 'ghost'}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <a href={`/ops/money${qs({ tab: 'webhooks', outcome, cursor: nextCursor })}`} className="inline-block text-sm text-[#58a6ff] hover:underline">
          الأقدم ↓
        </a>
      )}
    </section>
  );
}
