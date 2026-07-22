import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { CommsPanel, type TemplateListItem } from './comms-panel';
import { NOTIFICATION_DISABLED_KINDS_KEY } from './comms-labels';
import { SettingsTabs } from './settings-tabs';
import { SettingRow, type SettingItem } from './settings-form';

/**
 * OPS Phase 2 — «الإعدادات». The DB-backed platform settings catalog: each key
 * with its effective value + source (db | default). Editing a key is the
 * governed settings.update operation (SENSITIVE, reason-gated, reversible by
 * writing the previous value back). Everything OUTSIDE the catalog — fees, VAT,
 * duration caps, kill-switches, feature flags — stays CODE/ENV-owned by design
 * and is surfaced here read-only so operators know it exists but isn't editable.
 */

const ENV_MANAGED: Array<{ nameAr: string; keyHint: string; whyAr: string }> = [
  {
    nameAr: 'رسوم المنصة والعمولة',
    keyHint: 'config/fees.ts',
    whyAr: 'مثبَّتة بعقود المزوّدين (فوترة ZATCA وصافي الصرف) — لا تُحرَّك من شاشة حتى تستقر العقود.',
  },
  {
    nameAr: 'ضريبة القيمة المضافة (VAT)',
    keyHint: 'config/fees.ts',
    whyAr: 'مرتبطة بالفوترة الضريبية — تُدار في الكود مع بنية الرسوم.',
  },
  {
    nameAr: 'سقف مدة الحملة',
    keyHint: 'ENV / config',
    whyAr: 'حد زمني للسياسة يُدار بيئياً حتى تُدرَج قيمته في الكتالوج.',
  },
  {
    nameAr: 'مفتاح إيقاف الوكلاء',
    keyHint: 'AGENTS_ENABLED',
    whyAr: 'مفتاح إيقاف بيئي — صف قاعدة بيانات يجب ألّا يُعيد تفعيل الوكلاء أبداً.',
  },
  {
    nameAr: 'تجاوز الأربع أعين للمال',
    keyHint: 'FOUR_EYES_MONEY_OVERRIDE',
    whyAr: 'مفتاح بيئي — لا يجوز إضعاف قاعدة الأربع أعين من صف قاعدة بيانات.',
  },
];

/** Communications backend readiness — drives the amber degrade states. */
type CommsState = 'ok' | 'building' | 'refused' | 'down';

export default async function OpsSettingsPage() {
  await requireAdmin();
  const { opsToken, info } = await requireOpsSession();

  let items: SettingItem[] = [];
  let refused = false;

  try {
    const r = await fetch(`${API_BASE}/v1/ops/settings`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.status === 403) refused = true;
    if (r.ok) items = ((await r.json()) as { items: SettingItem[] }).items;
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  // The disabledKinds value lives in the same catalog; read it here and hide it
  // from the catalog list (it's managed on the «الاتصالات» tab instead).
  const disabledRow = items.find((it) => it.key === NOTIFICATION_DISABLED_KINDS_KEY);
  const disabledKinds = Array.isArray(disabledRow?.value)
    ? (disabledRow!.value as unknown[]).map(String)
    : [];
  const catalogItems = items.filter((it) => it.key !== NOTIFICATION_DISABLED_KINDS_KEY);

  // Email templates — degrade to amber on 404/403 rather than fabricate.
  let templates: TemplateListItem[] = [];
  let commsState: CommsState = 'ok';
  try {
    const r = await fetch(`${API_BASE}/v1/ops/comms/templates`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.status === 404) commsState = 'building';
    else if (r.status === 403) commsState = 'refused';
    else if (r.ok) templates = ((await r.json()) as { items: TemplateListItem[] }).items ?? [];
    else commsState = 'down';
  } catch {
    commsState = 'down';
  }

  const catalogPanel = refused ? (
    <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      تفتقد صلاحية القراءة (settings.write أو analytics.read) لعرض الإعدادات.
    </p>
  ) : (
    <>
      <section className="grid gap-4">
        {catalogItems.length === 0 ? (
          <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
            لا إعدادات لعرضها (الخادم غير متاح).
          </p>
        ) : (
          catalogItems.map((it) => <SettingRow key={it.key} item={it} />)
        )}
      </section>

      {/* env-managed — informational, never editable here */}
      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold">
          إعدادات مملوكة للكود/البيئة (غير قابلة للتعديل هنا)
        </h2>
        <p className="text-xs text-[#8b949e]">
          هذه العناصر لا تُمثَّل في كتالوج قاعدة البيانات عمداً — صف قاعدة بيانات يجب ألّا يقدر على
          تعديلها. تُعرض هنا للعلم فقط.
        </p>
        <div className="overflow-x-auto rounded-lg border border-[#21262d]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[#161b22] text-right text-[#8b949e]">
              <tr>
                <th className="px-3 py-2 font-medium">الإعداد</th>
                <th className="px-3 py-2 font-medium">المصدر</th>
                <th className="px-3 py-2 font-medium">لماذا خارج الكتالوج</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
              {ENV_MANAGED.map((e) => (
                <tr key={e.nameAr} className="align-top">
                  <td className="px-3 py-2">{e.nameAr}</td>
                  <td className="px-3 py-2">
                    <code dir="ltr" className="text-xs text-[#8b949e]">
                      {e.keyHint}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-xs text-[#8b949e]">{e.whyAr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  const commsPanel =
    commsState === 'refused' ? (
      <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية settings.write لإدارة الاتصالات.
      </p>
    ) : commsState === 'building' || commsState === 'down' ? (
      <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        قيد الإنشاء — واجهة الاتصالات في الخادم غير متاحة بعد.
      </p>
    ) : (
      <CommsPanel
        templates={templates}
        disabledKinds={disabledKinds}
        operatorEmail={info.email}
      />
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">الإعدادات</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            إعدادات المنصة المدعومة بقاعدة البيانات — التعديل عملية محوكمة (settings.update) قابلة
            للعكس ومسجَّلة في التدقيق
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      <SettingsTabs catalog={catalogPanel} comms={commsPanel} />
    </div>
  );
}
