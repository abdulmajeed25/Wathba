import Link from 'next/link';
import { type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

const SIZE: Record<Size, { pad: string; text: string; radius: string }> = {
  sm: { pad: 'px-[12px] py-[7px]',   text: 'text-[12px]',   radius: 'rounded-(--radius-md)' },
  md: { pad: 'px-[19px] py-[11px]',  text: 'text-[14px]',   radius: 'rounded-(--radius-brand)' },
  lg: { pad: 'px-[28px] py-[15px]',  text: 'text-[16px]',   radius: 'rounded-(--radius-btn)' },
};

function classes(variant: Variant, size: Size, extra?: string) {
  const s = SIZE[size];
  const base = cn('inline-flex items-center justify-center gap-[9px] font-bold', s.pad, s.text, s.radius);

  if (variant === 'primary') {
    return cn(base, 'btnp text-on-accent', extra);
  }
  if (variant === 'outline') {
    return cn(base, 'btng border text-text font-semibold', extra);
  }
  // ghost = same as outline visually in this design language
  return cn(base, 'btng border text-text font-semibold', extra);
}

const PRIMARY_STYLE = { background: 'var(--grad)' };
const OUTLINE_STYLE = { background: 'transparent', borderColor: 'rgba(var(--ink-rgb),0.16)' };

export function Button(props: BaseProps & ComponentProps<'button'>) {
  const { variant = 'primary', size = 'md', className, children, style, ...rest } = props;
  return (
    <button
      type="button"
      className={classes(variant, size, className)}
      style={{
        ...(variant === 'primary' ? PRIMARY_STYLE : OUTLINE_STYLE),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

interface ButtonLinkProps extends BaseProps {
  href: string;
}

export function ButtonLink({ variant = 'primary', size = 'md', className, children, href }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={classes(variant, size, className)}
      style={variant === 'primary' ? PRIMARY_STYLE : OUTLINE_STYLE}
    >
      {children}
    </Link>
  );
}
