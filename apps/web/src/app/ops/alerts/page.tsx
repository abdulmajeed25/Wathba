import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';

/**
 * OPS-360 Unit 3 — «مركز التنبيهات»: the dedicated anomaly center. Server-first,
 * one read of GET /v1/ops/alerts, grouped by severity (critical → warn → info).
 * Each firing alert links to the screen that fixes it. A broken audit chain
 * surfaces both as its own critical alert and as a prominent banner. 403 →
 * amber; reachable from the home anomaly strip.
 */

interface OpsAlert {
  key: string;
  severity: 'critical' | 'warn' | 'info';
  titleAr: string;
  count: number;
  detailAr: string;
  href: string;
}
interface AlertsBody {
  items: OpsAlert[];
  chainOk: boolean;
  generatedAt: string;
}

const GROUPS: Array<{
  severity: OpsAlert['severity'];
  labelAr: string;
  hintAr: string;
  card: string;
  count: string;
  dot: string;
}> = [
  {
    severity: 'critical',
    labelAr: 'حرجة',
    hintAr: 'تحتاج تدخّلاً فورياً — خطر مالي أو أمني.',
    card: 'border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20',
    count: 'bg-red-500/20 text-red-200',
    dot: 'bg-red-400',
  },
  {
    severity: 'warn',
    labelAr: 'تحذيرية',
    hintAr: 'تحتاج مراجعة قريبة قبل أن تتفاقم.',
    card: 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
    count: 'bg-amber-500/20 text-amber-200',
    dot: 'bg-amber-400',
  },
  {
    severity: 'info',
    labelAr: 'إعلامية',
    hintAr: 'قوائم عمل قائمة — للعلم والمتابعة.',
    card: 'border-[#30363d] bg-[#161b22] text-[#8b949e] hover:bg-[#1c2128]',
    count: 'bg-[#21262d] text-[#8b949e]',
    dot: 'bg-[#484f58]',
  },
];

export default async function OpsAlertsPage() {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();

  let alerts: AlertsBody | null = null;
  let refused = false;
  try {
    const r = await fetch(`${API_BASE}/v1/ops/alerts`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.status === 403) refused = true;
    if (r.ok) alerts = (await r.json()) as AlertsBody;
  } catch {
    /* API unreachable — empty/refused states render below */
  }

  const items = alerts?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">مركز التنبيهات</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            مرصد الشذوذ المُوحَّد — كل تنبيه مُفعَّل مُرتَّب من الحرج إلى الإعلامي، مع رابط إلى
            الشاشة التي تُعالجه.
            {alerts ? (
              <>
                {' '}
                · حُدِّث {new Date(alerts.generatedAt).toLocaleTimeString('ar-SA-u-nu-latn')}
              </>
            ) : null}
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية عرض التنبيهات — اطلبها من المالك.
        </p>
      ) : null}

      {!alerts && !refused ? (
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
          تعذّر جلب التنبيهات الآن — تحقّق من اتصال واجهة العمليات ثم أعد التحميل.
        </p>
      ) : null}

      {alerts && alerts.chainOk === false ? (
        <Link
          href="/ops/audit"
          className="flex items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-500/25"
        >
          <span aria-hidden className="text-lg">⛓️‍💥</span>
          سلسلة التدقيق مكسورة — تلاعب محتمل بالسجل. عاملها كحادثة أمنية وتحقّق فوراً.
        </Link>
      ) : null}

      {alerts && items.length === 0 ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-6 text-center text-sm text-emerald-300">
          لا تنبيهات مُفعَّلة — كل المؤشرات ضمن الحدود الطبيعية.
        </p>
      ) : null}

      {GROUPS.map((g) => {
        const groupItems = items.filter((a) => a.severity === g.severity);
        if (groupItems.length === 0) return null;
        return (
          <section key={g.severity} aria-labelledby={`alerts-${g.severity}`} className="space-y-3">
            <div className="flex items-center gap-2">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${g.dot}`} />
              <h2 id={`alerts-${g.severity}`} className="text-base font-bold">
                {g.labelAr}
                <span className="ms-2 text-xs font-normal text-[#8b949e]">{g.hintAr}</span>
              </h2>
            </div>
            <ul className="space-y-2">
              {groupItems.map((a) => (
                <li key={a.key}>
                  <Link
                    href={a.href}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${g.card}`}
                  >
                    <span className="min-w-0">
                      <span className="font-bold">{a.titleAr}</span>
                      {/* Same as the dashboard's alert row — see ops/page.tsx.
                          opacity-80 on the faint ink is 3.79:1 on white. Fixed
                          here too rather than only where the spec sampled, or
                          this board fails the moment its board list grows. */}
                      <span className="mt-0.5 block text-xs">{a.detailAr}</span>
                      <code dir="ltr" className="mt-1 block text-[10px] opacity-60">
                        {a.key}
                      </code>
                    </span>
                    <span
                      className={`shrink-0 rounded px-2.5 py-1 text-base font-bold tabular-nums ${g.count}`}
                    >
                      {a.count.toLocaleString('ar-SA-u-nu-latn')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
