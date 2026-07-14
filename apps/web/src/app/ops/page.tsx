import { API_BASE, requireAdmin, requireOpsSession } from './_lib/guard';
import { LeaveButton } from './_components/leave-button';
import { StepUpCard } from './_components/step-up-card';
import { TotpCard } from './_components/totp-card';

interface ManifestItem {
  key: string;
  titleAr: string;
  permission: string;
  riskTier: 'CONTENT' | 'STANDARD' | 'SENSITIVE' | 'MONEY';
  reversible: boolean;
}

const TIER_ORDER: ManifestItem['riskTier'][] = ['MONEY', 'SENSITIVE', 'STANDARD', 'CONTENT'];
const TIER_STYLE: Record<ManifestItem['riskTier'], string> = {
  MONEY: 'border-red-500/40 bg-red-500/10 text-red-300',
  SENSITIVE: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  STANDARD: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  CONTENT: 'border-[#30363d] bg-[#161b22] text-[#8b949e]',
};

/**
 * OPS Part 1 — the landing shell: live session state, step-up, TOTP
 * enrollment and the registry manifest (read through the ops session —
 * proof the hardened surface is the one serving this page).
 */
export default async function OpsHomePage() {
  await requireAdmin();
  const { opsToken, info } = await requireOpsSession();

  let items: ManifestItem[] = [];
  try {
    const r = await fetch(`${API_BASE}/v1/ops/operations`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.ok) items = ((await r.json()) as { items: ManifestItem[] }).items;
  } catch {
    /* manifest unavailable — the shell still renders session controls */
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#21262d] bg-[#161b22] p-5">
        <div>
          <h1 className="text-lg font-bold">جلسة العمليات نشطة</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            {info.email} · دخلت {new Date(info.enteredAt).toLocaleTimeString('ar-SA')} · تنتهي
            بعد ٦٠ دقيقة من الخمول
          </p>
        </div>
        <LeaveButton />
      </section>

      {info.totpPending ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          التحقق الثنائي إلزامي لحسابك ولم يُفعَّل بعد — كل عمليات المال والصلاحيات
          مرفوضة حتى تفعيله أدناه.
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <StepUpCard fresh={info.stepUpFresh} stepUpAt={info.stepUpAt} totpEnabled={info.totpEnabled} />
        <TotpCard enabled={info.totpEnabled} required={info.totpRequired} />
      </div>

      <section>
        <h2 className="mb-3 text-base font-bold">سجل العمليات المتاحة ({items.length})</h2>
        <div className="space-y-2">
          {TIER_ORDER.filter((t) => items.some((i) => i.riskTier === t)).map((tier) => (
            <details key={tier} className="rounded-lg border border-[#21262d] bg-[#0d1117]" open={tier === 'MONEY'}>
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-bold">
                <span className={`ml-2 rounded border px-2 py-0.5 text-[11px] ${TIER_STYLE[tier]}`}>{tier}</span>
                {items.filter((i) => i.riskTier === tier).length} عملية
              </summary>
              <ul className="divide-y divide-[#21262d] border-t border-[#21262d]">
                {items
                  .filter((i) => i.riskTier === tier)
                  .map((i) => (
                    <li key={i.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span>{i.titleAr}</span>
                      <code className="text-[11px] text-[#8b949e]" dir="ltr">
                        {i.key}
                      </code>
                    </li>
                  ))}
              </ul>
            </details>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#484f58]">
          التنفيذ من هذه الشاشة يصل في الجزء الخامس — هذا الجزء يثبّت الجلسة
          المنفصلة، وإعادة التوثيق، والتحقق الثنائي.
        </p>
      </section>
    </div>
  );
}
