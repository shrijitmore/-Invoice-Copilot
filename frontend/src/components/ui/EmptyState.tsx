import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional call-to-action button. */
  action?: ReactNode;
}

/**
 * Friendly empty state with an illustration icon and a CTA.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-in">
      <div className="mb-4 rounded-full bg-navy-50 p-5 dark:bg-navy-800">
        <Icon className="h-10 w-10 text-navy-600 dark:text-navy-200" aria-hidden />
      </div>
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="mb-6 max-w-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action}
    </div>
  );
}
