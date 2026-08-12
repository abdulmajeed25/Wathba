'use client';

import { useState } from 'react';

import { OpRunner } from '../../_components/op-runner';

/**
 * OPS Phase 2 — «وسم شراكة وثبة (§7)» island. The op input is structured
 * ({ stakeType, disclosureAr } | null), so a plain OpRunner button can't
 * carry it. This collects the disclosure locally, then hands a computed
 * `input` to the governed OpRunner (still dry-run → preview → execute).
 */

const STAKE_TYPES: Array<{ value: 'equity' | 'profit-share' | 'co-founder'; labelAr: string }> = [
  { value: 'equity', labelAr: 'حصة ملكية' },
  { value: 'profit-share', labelAr: 'مشاركة أرباح' },
  { value: 'co-founder', labelAr: 'شريك مؤسِّس' },
];

export function PartnerRunner({ projectId }: { projectId: string }) {
  const [stakeType, setStakeType] = useState<'equity' | 'profit-share' | 'co-founder'>('equity');
  const [disclosure, setDisclosure] = useState('');
  const disclosureOk = disclosure.trim().length >= 20;

  return (
    <div className="space-y-3 rounded border border-[#30363d] bg-[#0d1117] p-3">
      <p className="text-sm font-bold">وسم شراكة وثبة (§7)</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={stakeType}
          onChange={(e) => setStakeType(e.target.value as typeof stakeType)}
          aria-label="نوع الحصة"
          className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm"
        >
          {STAKE_TYPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.labelAr}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={disclosure}
        onChange={(e) => setDisclosure(e.target.value)}
        rows={2}
        placeholder="نص الإفصاح الإلزامي (20 حرفاً على الأقل)"
        aria-label="نص الإفصاح"
        className="w-full rounded border border-[#30363d] bg-[#161b22] px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      <div className="flex flex-wrap items-center gap-2">
        <OpRunner
          opKey="projects.platform-partner.set"
          input={{ projectId, value: { stakeType, disclosureAr: disclosure.trim() } }}
          triggerLabel="ضبط الوسم"
          variant="ghost"
          disabled={!disclosureOk}
          requiresReason={false}
          riskTier="STANDARD"
        />
        <OpRunner
          opKey="projects.platform-partner.set"
          input={{ projectId, value: null }}
          triggerLabel="إزالة الوسم"
          variant="ghost"
          requiresReason={false}
          riskTier="STANDARD"
        />
      </div>
    </div>
  );
}
