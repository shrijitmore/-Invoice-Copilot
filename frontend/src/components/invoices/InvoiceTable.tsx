import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { DateFormat, Invoice, InvoiceListParams } from '../../types/api';
import { StatusBadge } from '../ui/Badge';

type SortField = NonNullable<InvoiceListParams['sortBy']>;

const COLUMNS: Array<{ field: SortField; label: string; className?: string }> = [
  { field: 'vendorName', label: 'Vendor' },
  { field: 'amount', label: 'Amount', className: 'text-right' },
  { field: 'dueDate', label: 'Due date' },
  { field: 'status', label: 'Status' },
];

export interface InvoiceTableProps {
  invoices: Invoice[];
  dateFormat: DateFormat;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

/**
 * Sortable, selectable invoice table. Rows navigate to the detail view;
 * checkboxes drive bulk actions.
 */
export function InvoiceTable({
  invoices,
  dateFormat,
  sortBy,
  sortOrder,
  onSort,
  selected,
  onToggleSelect,
  onToggleSelectAll,
}: InvoiceTableProps): JSX.Element {
  const navigate = useNavigate();
  const allSelected = invoices.length > 0 && invoices.every((invoice) => selected.has(invoice._id));

  const sortIcon = (field: SortField): JSX.Element => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[640px] border-collapse bg-white text-left dark:bg-slate-800">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
            <th className="w-12 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                aria-label="Select all invoices on this page"
                className="h-4 w-4 rounded border-slate-300 accent-navy-700"
              />
            </th>
            {COLUMNS.map((column) => (
              <th key={column.field} className={cn('px-4 py-3', column.className)}>
                <button
                  type="button"
                  onClick={() => onSort(column.field)}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-navy-700 dark:text-slate-300 dark:hover:text-white',
                    column.className === 'text-right' && 'flex-row-reverse',
                  )}
                  aria-label={`Sort by ${column.label}`}
                >
                  {column.label}
                  {sortIcon(column.field)}
                </button>
              </th>
            ))}
            <th className="px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Invoice #
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={invoice._id}
              onClick={() => navigate(`/invoices/${invoice._id}`)}
              className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-navy-50/50 dark:border-slate-700/60 dark:hover:bg-navy-800/30"
            >
              <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(invoice._id)}
                  onChange={() => onToggleSelect(invoice._id)}
                  aria-label={`Select invoice from ${invoice.vendorName}`}
                  className="h-4 w-4 rounded border-slate-300 accent-navy-700"
                />
              </td>
              <td className="px-4 py-3 font-medium">{invoice.vendorName}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatCurrency(invoice.amount, invoice.currency)}
              </td>
              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                {formatDate(invoice.dueDate, dateFormat)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={invoice.status} />
              </td>
              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                {invoice.invoiceNumber || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
