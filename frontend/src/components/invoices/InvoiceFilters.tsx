import { Search } from 'lucide-react';
import { Input, Select } from '../ui/Input';
import type { InvoiceListParams, InvoiceStatus } from '../../types/api';

export interface InvoiceFiltersProps {
  filters: InvoiceListParams;
  vendors: string[];
  onChange: (next: InvoiceListParams) => void;
}

/**
 * Filter bar for the invoice list: text search, status, vendor, date range
 * and amount range. Changing any filter resets pagination.
 */
export function InvoiceFilters({ filters, vendors, onChange }: InvoiceFiltersProps): JSX.Element {
  const set = (patch: Partial<InvoiceListParams>): void => {
    onChange({ ...filters, ...patch, page: 1 });
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="relative xl:col-span-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={filters.search ?? ''}
          onChange={(event) => set({ search: event.target.value || undefined })}
          placeholder="Search by vendor or invoice number"
          aria-label="Search invoices"
          className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-base dark:border-slate-600 dark:bg-slate-800"
        />
      </div>
      <Select
        aria-label="Filter by status"
        value={filters.status ?? ''}
        onChange={(event) => set({ status: (event.target.value || undefined) as InvoiceStatus | undefined })}
        options={[
          { value: '', label: 'All statuses' },
          { value: 'unpaid', label: 'Unpaid' },
          { value: 'paid', label: 'Paid' },
          { value: 'overdue', label: 'Overdue' },
        ]}
      />
      <Select
        aria-label="Filter by vendor"
        value={filters.vendor ?? ''}
        onChange={(event) => set({ vendor: event.target.value || undefined })}
        options={[
          { value: '', label: 'All vendors' },
          ...vendors.map((vendor) => ({ value: vendor, label: vendor })),
        ]}
      />
      <Input
        type="date"
        aria-label="Due date from"
        value={filters.dateFrom ?? ''}
        onChange={(event) => set({ dateFrom: event.target.value || undefined })}
      />
      <Input
        type="date"
        aria-label="Due date to"
        value={filters.dateTo ?? ''}
        onChange={(event) => set({ dateTo: event.target.value || undefined })}
      />
      <Input
        type="number"
        min={0}
        aria-label="Minimum amount"
        placeholder="Min amount"
        value={filters.minAmount ?? ''}
        onChange={(event) =>
          set({ minAmount: event.target.value === '' ? undefined : Number(event.target.value) })
        }
      />
      <Input
        type="number"
        min={0}
        aria-label="Maximum amount"
        placeholder="Max amount"
        value={filters.maxAmount ?? ''}
        onChange={(event) =>
          set({ maxAmount: event.target.value === '' ? undefined : Number(event.target.value) })
        }
      />
    </div>
  );
}
