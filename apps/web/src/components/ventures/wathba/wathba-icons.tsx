'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * Material Symbols Rounded glyph — the `.ico` class from WATBHوثبة.dc.html.
 * The variable font lives in <head>; the class controls FILL via axis tags.
 */
export function Icon({
  name,
  size = 20,
  fill = false,
  color,
  style,
}: {
  name: string;
  size?: number;
  fill?: boolean;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="ico"
      style={{
        fontFamily: '"Material Symbols Rounded"',
        fontWeight: 'normal',
        fontStyle: 'normal',
        lineHeight: 1,
        letterSpacing: 'normal',
        textTransform: 'none',
        display: 'inline-block',
        whiteSpace: 'nowrap',
        direction: 'ltr',
        WebkitFontFeatureSettings: '"liga"',
        fontFeatureSettings: '"liga"',
        WebkitFontSmoothing: 'antialiased',
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0},'wght' 400,'GRAD' 0,'opsz' 24`,
        color,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

/** Numeric wrapper — Space Grotesk + tabular-nums (the `.num` class). */
export function Num({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        fontFamily: '"Space Grotesk", sans-serif',
        fontFeatureSettings: '"tnum"',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
