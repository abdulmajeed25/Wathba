'use client';

import { useEffect, useState } from 'react';

import {
  applyDensity,
  applyTheme,
  readDensity,
  readTheme,
  type OpsDensity,
  type OpsTheme,
} from '../_lib/theme';

/**
 * OPS Phase B (Unit 2) — appearance controls mounted in the shell header.
 *
 * Two small segmented toggles: theme (داكن/فاتح) and density (مريح/مضغوط). The
 * actual value lives as a `data-theme`/`data-density` attribute on the ops
 * root (stamped pre-paint by THEME_INIT_SCRIPT); this island only mirrors and
 * mutates it, persisting the choice to localStorage. Rendered null until
 * mounted so SSR markup matches the (attribute-driven) client without a
 * hydration mismatch. Fully keyboard reachable; each option is a real button.
 */

function Segmented<T extends string>({
  legend,
  value,
  options,
  onPick,
}: {
  legend: string;
  value: T;
  options: Array<{ value: T; label: string; title: string }>;
  onPick: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={legend}
      className="flex items-center rounded border border-[#30363d] bg-[#161b22] p-0.5 text-[11px]"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            aria-pressed={active}
            title={o.title}
            className={`rounded px-2 py-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff] ${
              active ? 'bg-[#21262d] font-bold text-[#e6edf3]' : 'text-[#8b949e] hover:text-[#e6edf3]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<OpsTheme>('dark');
  const [density, setDensity] = useState<OpsDensity>('comfortable');

  useEffect(() => {
    setTheme(readTheme());
    setDensity(readDensity());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Segmented<OpsTheme>
        legend="سمة العرض"
        value={theme}
        onPick={(v) => {
          setTheme(v);
          applyTheme(v);
        }}
        options={[
          { value: 'dark', label: 'داكن', title: 'سمة داكنة' },
          { value: 'light', label: 'فاتح', title: 'سمة فاتحة' },
        ]}
      />
      <Segmented<OpsDensity>
        legend="كثافة العرض"
        value={density}
        onPick={(v) => {
          setDensity(v);
          applyDensity(v);
        }}
        options={[
          { value: 'comfortable', label: 'مريح', title: 'تباعد مريح' },
          { value: 'compact', label: 'مضغوط', title: 'تباعد مضغوط' },
        ]}
      />
    </div>
  );
}
