'use client';

import { useState, type ReactNode } from 'react';

/**
 * OPS-GAPS Y2 — the settings screen gains a second surface, so the page splits
 * into two tabs («الكتالوج» / «الاتصالات»). Both tab bodies are server-rendered
 * ReactNode slots passed in as props (the catalog SettingRows and the
 * Communications panel); this client wrapper only owns which one is visible.
 * Server components handed to a client component as props render fine — no
 * client function is exported for a server component to call.
 */

type TabKey = 'catalog' | 'comms';

export function SettingsTabs({
  catalog,
  comms,
}: {
  catalog: ReactNode;
  comms: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>('catalog');

  const tabs: Array<{ key: TabKey; labelAr: string }> = [
    { key: 'catalog', labelAr: 'الكتالوج' },
    { key: 'comms', labelAr: 'الاتصالات' },
  ];

  return (
    <div className="space-y-5">
      <div role="tablist" className="flex gap-1 border-b border-[#21262d]">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'border-emerald-500 text-[#e6edf3]'
                  : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'
              }`}
            >
              {t.labelAr}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{tab === 'catalog' ? catalog : comms}</div>
    </div>
  );
}
