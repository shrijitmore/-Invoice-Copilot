import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Elevated surface container used across the app.
 */
export function Card({ className, children, ...rest }: CardProps): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
