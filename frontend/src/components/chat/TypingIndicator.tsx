import { Bot } from 'lucide-react';

/**
 * Animated three-dot typing indicator shown while the AI is thinking,
 * optionally with a tool-status label ("Checking overdue invoices…").
 */
export function TypingIndicator({ label }: { label?: string | null }): JSX.Element {
  return (
    <div className="flex gap-3 animate-fade-in" role="status" aria-label="AI is typing">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700 text-white">
        <Bot className="h-5 w-5" aria-hidden />
      </span>
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <span className="flex gap-1">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-2 w-2 rounded-full bg-navy-400 animate-bounce-dot"
              style={{ animationDelay: `${index * 0.15}s` }}
              aria-hidden
            />
          ))}
        </span>
        {label && <span className="text-sm text-slate-500 dark:text-slate-400">{label}…</span>}
      </div>
    </div>
  );
}
