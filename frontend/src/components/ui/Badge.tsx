import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import type { InvoiceStatus } from '../../types/api';

type Tone = 'green' | 'amber' | 'red' | 'gray' | 'navy';

const toneClasses: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  gray: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  navy: 'bg-navy-100 text-navy-800 dark:bg-navy-700 dark:text-navy-100',
};

/**
 * Small status pill.
 */
export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

const statusTones: Record<InvoiceStatus, Tone> = {
  paid: 'green',
  unpaid: 'amber',
  overdue: 'red',
};

const statusLabels: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
};

/**
 * Invoice status pill with the canonical color per status.
 */
export function StatusBadge({ status }: { status: InvoiceStatus }): JSX.Element {
  return <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>;
}
