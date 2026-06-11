import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Optional percent change vs the prior period. */
  changePercent?: number | null;
  /** Optional caption under the value. */
  caption?: string;
}

/**
 * Dashboard metric card with an optional trend indicator.
 */
export function StatCard({ icon: Icon, label, value, changePercent, caption }: StatCardProps): JSX.Element {
  const showTrend = changePercent !== undefined && changePercent !== null;
  const positive = (changePercent ?? 0) <= 0; // lower spend = good

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <span className="rounded-lg bg-navy-50 p-2.5 dark:bg-navy-800">
          <Icon className="h-5 w-5 text-navy-700 dark:text-navy-200" aria-hidden />
        </span>
      </div>
      {showTrend && (
        <p
          className={cn(
            'mt-3 flex items-center gap-1 text-sm font-medium',
            positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
          )}
        >
          {(changePercent ?? 0) >= 0 ? (
            <TrendingUp className="h-4 w-4" aria-hidden />
          ) : (
            <TrendingDown className="h-4 w-4" aria-hidden />
          )}
          {Math.abs(changePercent ?? 0).toFixed(1)}% vs last month
        </p>
      )}
      {caption && <p className="mt-3 text-sm text-slate-400">{caption}</p>}
    </Card>
  );
}
