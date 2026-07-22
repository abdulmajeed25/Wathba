'use client';

import { useState } from 'react';

import { OpRunner } from '../../_components/op-runner';

/**
 * OPS Phase 2 — the per-user operations panel. EVERY mutation is an <OpRunner>
 * (dry-run → preview → reason → execute → audited); this island never touches
 * the API directly. It owns only the client state two ops need:
 *
 *  · users.pii.unmask — the revealed email/phone come back in the op RESULT
 *    (never stored in the ledger); we render them from onDone, in-page, once.
 *  · users.pdpl.export — the PDPL bundle returns to the caller; we offer it as
 *    a JSON download from onDone.
 *  · users.merge — the target account id is typed into a field, then folded
 *    into the op input.
 *
 * Buttons that only make sense in one state (suspend vs reactivate, ban vs
 * unban) are shown conditionally from the current suspension state. View-as /
 * impersonation has NO backing endpoint — it is rendered disabled («قريباً»),
 * never faked.
 */

interface Props {
  userId: string;
  userName: string;
  suspendedKind: 'SUSPENDED' | 'BANNED' | null;
  suspended: boolean;
}

const ASSIGNABLE_ROLES: Array<{ value: 'CREATOR' | 'BACKER' | 'SUPPLIER'; labelAr: string }> = [
  { value: 'CREATOR', labelAr: 'صاحب مشروع' },
  { value: 'BACKER', labelAr: 'داعم' },
  { value: 'SUPPLIER', labelAr: 'مورّد' },
];

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      {hint ? <p className="mt-0.5 text-xs text-[#8b949e]">{hint}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function UserOperations({ userId, userName, suspendedKind, suspended }: Props) {
  const banned = suspendedKind === 'BANNED';

  // users.pii.unmask — revealed values live only in component state, shown once.
  const [revealed, setRevealed] = useState<Record<string, string | null> | null>(null);

  // users.role.grant/revoke — which role the two buttons act on.
  const [grantRole, setGrantRole] = useState<'CREATOR' | 'BACKER' | 'SUPPLIER'>('SUPPLIER');

  // users.merge — the surviving (target) account id.
  const [targetId, setTargetId] = useState('');

  function downloadBundle(result: unknown) {
    try {
      const json = JSON.stringify(result, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `pdpl-export-${userId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* download best-effort; the fact of export is already audited */
    }
  }

  return (
    <div className="space-y-4">
      <Group
        title="دورة حياة الحساب"
        hint="الإيقاف قابل للعكس ويُلغي كل الجلسات فوراً؛ الحظر عملية إشراف دائمة."
      >
        {suspended ? (
          <OpRunner
            opKey="users.reactivate"
            input={{ userId }}
            triggerLabel="إعادة تفعيل"
            requiresReason
            riskTier="SENSITIVE"
            variant="primary"
          />
        ) : (
          <OpRunner
            opKey="users.suspend"
            input={{ userId }}
            triggerLabel="إيقاف الحساب"
            requiresReason
            riskTier="SENSITIVE"
            variant="danger"
          />
        )}
        {banned ? (
          <OpRunner
            opKey="moderation.user.unban"
            input={{ userId }}
            triggerLabel="رفع الحظر"
            requiresReason
            riskTier="SENSITIVE"
            variant="primary"
          />
        ) : (
          <OpRunner
            opKey="moderation.user.ban"
            input={{ userId }}
            triggerLabel="حظر نهائي"
            requiresReason
            riskTier="SENSITIVE"
            variant="danger"
          />
        )}
      </Group>

      <Group title="الجلسات والدخول" hint="إجراءات أمنية فورية على وصول المستخدم.">
        <OpRunner
          opKey="users.force-password-reset"
          input={{ userId }}
          triggerLabel="فرض إعادة تعيين كلمة المرور"
          requiresReason
          riskTier="SENSITIVE"
          variant="ghost"
        />
        <OpRunner
          opKey="users.sessions.revoke"
          input={{ userId }}
          triggerLabel="إلغاء كل الجلسات"
          requiresReason
          riskTier="SENSITIVE"
          variant="ghost"
        />
        <span className="inline-flex" title="عرض بصفة المستخدم — لا يوجد نقطة نهاية بعد">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded border border-[#30363d] px-3 py-1.5 text-sm text-[#484f58]"
          >
            العرض بصفة المستخدم (قريباً)
          </button>
        </span>
      </Group>

      <Group
        title="التوثيق والأدوار"
        hint="منح/سحب أدوار المستخدم العامة، وفرض توثيق نفاذ يدوياً."
      >
        <label className="inline-flex items-center gap-1 text-xs text-[#8b949e]">
          الدور
          <select
            value={grantRole}
            onChange={(e) => setGrantRole(e.target.value as typeof grantRole)}
            aria-label="اختر الدور"
            className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-sm outline-none focus:border-emerald-500"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.labelAr}
              </option>
            ))}
          </select>
        </label>
        <OpRunner
          key={`grant-${grantRole}`}
          opKey="users.role.grant"
          input={{ userId, role: grantRole }}
          triggerLabel="منح الدور"
          requiresReason
          riskTier="SENSITIVE"
          variant="ghost"
        />
        <OpRunner
          key={`revoke-${grantRole}`}
          opKey="users.role.revoke"
          input={{ userId, role: grantRole }}
          triggerLabel="سحب الدور"
          requiresReason
          riskTier="SENSITIVE"
          variant="ghost"
        />
        <OpRunner
          opKey="users.kyc.force-verify"
          input={{ userId }}
          triggerLabel="فرض توثيق نفاذ"
          requiresReason
          riskTier="SENSITIVE"
          variant="ghost"
        />
      </Group>

      <Group
        title="كشف البيانات الشخصية"
        hint="كشف محكوم ومدوَّن في التدقيق. القيم تعود في نتيجة العملية ولا تُخزَّن — وتظهر هنا مرة واحدة."
      >
        <OpRunner
          opKey="users.pii.unmask"
          input={{ userId, fields: ['email', 'phone'] }}
          triggerLabel="كشف البريد والهاتف"
          requiresReason
          riskTier="SENSITIVE"
          variant="danger"
          onDone={(result) => {
            const values = (result as { values?: Record<string, string | null> }).values ?? null;
            setRevealed(values);
          }}
        />
        {revealed ? (
          <dl
            dir="ltr"
            className="w-full space-y-1 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
          >
            {Object.entries(revealed).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt className="text-amber-300/80">{k}</dt>
                <dd className="font-mono">{v ?? '—'}</dd>
              </div>
            ))}
            <p dir="rtl" className="pt-1 text-[11px] text-amber-300/70">
              كُشفت وسُجّلت باسمك في التدقيق. لن تُعرض ثانيةً بعد مغادرة الصفحة.
            </p>
          </dl>
        ) : null}
      </Group>

      <Group
        title="PDPL — حقوق البيانات"
        hint="تصدير نسخة كاملة (تُنزَّل للطالب) أو تجهيل الحساب نهائياً."
      >
        <OpRunner
          opKey="users.pdpl.export"
          input={{ userId }}
          triggerLabel="تصدير بيانات (PDPL)"
          requiresReason
          riskTier="SENSITIVE"
          variant="ghost"
          onDone={downloadBundle}
        />
        <OpRunner
          opKey="users.pdpl.erase"
          input={{ userId }}
          triggerLabel="تجهيل الحساب (PDPL erase)"
          requiresReason
          riskTier="SENSITIVE"
          variant="danger"
        />
      </Group>

      <Group
        title="دمج حسابين"
        hint={`يُذيب هذا الحساب («${userName}») في الحساب الهدف ثم يُجهّله. غير قابل للعكس.`}
      >
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value.trim())}
          placeholder="معرّف الحساب الهدف (الباقي)"
          dir="ltr"
          aria-label="معرّف الحساب الهدف"
          className="min-w-[22rem] flex-1 rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 font-mono text-xs outline-none focus:border-emerald-500"
        />
        <OpRunner
          key={`merge-${targetId}`}
          opKey="users.merge"
          input={{ sourceUserId: userId, targetUserId: targetId }}
          triggerLabel="دمج في الهدف"
          requiresReason
          riskTier="SENSITIVE"
          variant="danger"
          disabled={targetId.length < 10 || targetId === userId}
        />
      </Group>
    </div>
  );
}
