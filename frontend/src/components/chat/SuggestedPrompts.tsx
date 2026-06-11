import { Bot, CalendarClock, PiggyBank, TriangleAlert } from 'lucide-react';

const PROMPTS = [
  { icon: CalendarClock, text: 'What invoices are due this week?' },
  { icon: PiggyBank, text: 'How much did I spend last month?' },
  { icon: TriangleAlert, text: 'Show me overdue invoices' },
] as const;

/**
 * Empty-chat welcome screen with one-click starter prompts.
 */
export function SuggestedPrompts({ onSelect }: { onSelect: (prompt: string) => void }): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center animate-fade-in">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-navy-100 dark:bg-navy-800">
        <Bot className="h-8 w-8 text-navy-700 dark:text-navy-200" aria-hidden />
      </span>
      <h2 className="mb-2 text-2xl font-bold">How can I help with your invoices?</h2>
      <p className="mb-8 max-w-md text-slate-500 dark:text-slate-400">
        Ask about spending, due dates, vendors or cash flow — I'll answer using your real invoice
        data.
      </p>
      <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        {PROMPTS.map(({ icon: Icon, text }) => (
          <button
            key={text}
            type="button"
            onClick={() => onSelect(text)}
            className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left text-base transition-all hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-navy-500"
          >
            <Icon className="h-5 w-5 text-navy-600 dark:text-navy-300" aria-hidden />
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
