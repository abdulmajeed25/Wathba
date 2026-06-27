'use client';

import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleLinear, scaleBand } from '@visx/scale';
import { toArabicDigits } from '@wathba/types';

interface Row { label: string; pct: number; color: string }

interface Props {
  rows: Row[];
  height?: number;
}

/**
 * Visx horizontal bar chart driving the Live Transparency Dashboard's
 * budget split. RTL-safe — bars grow from the right edge.
 */
export function BudgetChart({ rows, height = 36 * 4 + 24 }: Props) {
  const width = 600; // responsive width via viewBox
  const marginRight = 200; // room for labels (RTL)
  const innerWidth = width - marginRight;
  const yScale = scaleBand<string>({
    domain: rows.map((r) => r.label),
    range: [0, height],
    padding: 0.25,
  });
  const xScale = scaleLinear<number>({ domain: [0, 100], range: [0, innerWidth] });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
      <Group>
        {rows.map((r) => {
          const y = yScale(r.label) ?? 0;
          const w = xScale(r.pct);
          const barH = yScale.bandwidth();
          return (
            <g key={r.label} transform={`translate(0, ${y})`}>
              {/* track */}
              <Bar x={marginRight} y={barH / 2 - 4} width={innerWidth} height={8} fill="rgba(var(--ink-rgb),0.06)" rx={8} />
              {/* fill — RTL: grows from the right edge (x = marginRight + innerWidth - w) */}
              <Bar x={marginRight + innerWidth - w} y={barH / 2 - 4} width={w} height={8} fill={r.color} rx={8} />
              {/* label (right side, RTL) */}
              <text
                x={width - 10}
                y={barH / 2 + 4}
                textAnchor="end"
                fontSize={13.5}
                fill="var(--text-soft)"
                style={{ fontFamily: 'var(--font-arabic)' }}
              >
                {r.label}
              </text>
              {/* pct number (Space Grotesk) — to the left of the label */}
              <text
                x={marginRight - 10}
                y={barH / 2 + 4}
                textAnchor="end"
                fontSize={13}
                fill="var(--muted)"
                style={{ fontFamily: 'var(--font-grotesk)' }}
              >
                {toArabicDigits(r.pct)}%
              </text>
            </g>
          );
        })}
      </Group>
    </svg>
  );
}
