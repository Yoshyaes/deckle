import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** When true, the border lifts to the accent color on hover. */
  hover?: boolean;
  /** Inset padding shortcut: 'sm' = p-4, 'md' = p-5, 'lg' = p-6. Omit to control via className. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDINGS = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * Dashboard surface container. Replaces the ad-hoc
 * `bg-surface border border-border rounded-[14px]` string that
 * audit-10 flagged appearing 35+ times across 12 files.
 */
export function Card({
  children,
  hover = false,
  padding = 'none',
  className = '',
  ...rest
}: CardProps) {
  const classes = [
    'bg-surface border border-border rounded-[14px] overflow-hidden',
    hover ? 'transition-colors hover:border-accent/30' : '',
    PADDINGS[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
