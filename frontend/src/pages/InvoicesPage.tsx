import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { InvoiceFilters } from '../components/invoices/InvoiceFilters';
import { InvoiceTable } from '../components/invoices/InvoiceTable';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { api, downloadFile, getErrorMessage } from '../lib/api';
import type { InvoiceListParams, PaginatedInvoices } from '../types/api';

const DEFAULT_FILTERS: InvoiceListParams = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  limit: 20,
};

/**
 * Invoice list: filters, search, sortable columns, pagination, bulk
 * delete and CSV export.
 */
export function InvoicesPage(): JSX.Element {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<InvoiceListParams>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebounce(filters.search ?? '');

  const queryParams = useMemo(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', 'list', queryParams],
    queryFn: async () =>
      (await api.get<PaginatedInvoices>('/invoices', { params: queryParams })).data,
  });

  const { data: vendors } = useQuery({
    queryKey: ['invoices', 'vendors'],
    queryFn: async () => (await api.get<string[]>('/invoices/vendors')).data,
  });

  const bulkDelete = useMutation({
    mutationFn: () => api.post('/invoices/bulk-delete', { ids: [...selected] }),
    onSuccess: () => {
      toast.success(`Deleted ${selected.size} invoice${selected.size > 1 ? 's' : ''}`);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const exportCsv = async (): Promise<void> => {
    setExporting(true);
    try {
      await downloadFile('/invoices/export/csv', 'invoices.csv');
      toast.success('Export downloaded');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const onSort = (field: NonNullable<InvoiceListParams['sortBy']>): void => {
    setFilters((current) => ({
      ...current,
      sortBy: field,
      sortOrder: current.sortBy === field && current.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const toggleSelect = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (): void => {
    const pageIds = data?.items.map((invoice) => invoice._id) ?? [];
    setSelected((current) => {
      const allSelected = pageIds.every((id) => current.has(id));
      const next = new Set(current);
      for (const id of pageIds) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  const noFiltersActive =
    !queryParams.search &&
    !queryParams.status &&
    !queryParams.vendor &&
    !queryParams.dateFrom &&
    !queryParams.dateTo &&
    queryParams.minAmount === undefined &&
    queryParams.maxAmount === undefined;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {data ? `${data.total} invoice${data.total === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.size > 0 && (
            <Button variant="danger" onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete {selected.size}
            </Button>
          )}
          <Button variant="secondary" onClick={() => void exportCsv()} loading={exporting}>
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
          <Link to="/invoices/upload">
            <Button>
              <Upload className="h-4 w-4" aria-hidden />
              Upload
            </Button>
          </Link>
        </div>
      </div>

      <InvoiceFilters filters={filters} vendors={vendors ?? []} onChange={setFilters} />

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileText}
          title={noFiltersActive ? 'No invoices yet' : 'No invoices match your filters'}
          description={
            noFiltersActive
              ? 'Upload a PDF, snap a photo, or paste invoice text — the AI extracts everything for you.'
              : 'Try widening your search or clearing some filters.'
          }
          action={
            noFiltersActive ? (
              <Link to="/invoices/upload">
                <Button>Upload your first invoice</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <>
          <InvoiceTable
            invoices={data?.items ?? []}
            dateFormat={user?.settings.dateFormat ?? 'MM/DD/YYYY'}
            sortBy={filters.sortBy ?? 'createdAt'}
            sortOrder={filters.sortOrder ?? 'desc'}
            onSort={onSort}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
          {data && data.totalPages > 1 && (
            <nav className="flex items-center justify-between" aria-label="Pagination">
              <Button
                variant="secondary"
                size="sm"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-500">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={(filters.page ?? 1) >= data.totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}

      <Modal
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        title={`Delete ${selected.size} invoice${selected.size > 1 ? 's' : ''}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmBulkDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={bulkDelete.isPending}
              onClick={() => {
                bulkDelete.mutate();
                setConfirmBulkDelete(false);
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p>The selected invoices will be permanently removed. This cannot be undone.</p>
      </Modal>
    </div>
  );
}
