import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

type ButtonOnlyProps = ButtonHTMLAttributes<HTMLButtonElement> & CommonProps & { href?: undefined };
type LinkOnlyProps = CommonProps & {
  href: string;
  target?: string;
  rel?: string;
  onClick?: never;
  disabled?: never;
  type?: never;
};

type ButtonProps = ButtonOnlyProps | LinkOnlyProps;

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-accent to-orange-600 text-white font-semibold shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:opacity-90 disabled:opacity-50',
  secondary:
    'border border-border text-text-primary hover:border-accent/40 hover:bg-surface-hover transition-colors disabled:opacity-50',
  ghost:
    'text-text-muted hover:text-text-primary hover:bg-surface-hover/50 transition-colors disabled:opacity-50',
  destructive:
    'bg-red text-white font-semibold hover:bg-red/90 disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-sm rounded-lg',
};

/**
 * Single primary button primitive. Replaces the ad-hoc gradient
 * button copy-paste that audit-10 flagged across the dashboard.
 *
 * Renders an <a> when `href` is supplied (via next/link), otherwise
 * a <button>.
 */
export function Button(props: ButtonProps) {
  const variant: Variant = props.variant ?? 'primary';
  const size: Size = props.size ?? 'md';
  const classes = [
    'inline-flex items-center justify-center gap-1.5 transition-opacity',
    VARIANTS[variant],
    SIZES[size],
    props.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if ('href' in props && props.href) {
    const { href, children, target, rel } = props;
    return (
      <Link href={href} className={classes} target={target} rel={rel}>
        {children}
      </Link>
    );
  }

  const { children, variant: _v, size: _s, className: _c, href: _h, ...rest } = props as ButtonOnlyProps;
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
