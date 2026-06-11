import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Pencil, Save, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { api, getErrorMessage } from '../lib/api';
import { CURRENCY_SELECT_OPTIONS } from '../lib/constants';
import { formatCurrency, formatDate } from '../lib/format';
import type { Invoice } from '../types/api';

interface EditState {
  vendorName: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  issueDate: string;
  dueDate: string;
  notes: string;
}

function toEditState(invoice: Invoice): EditState {
  return {
    vendorName: invoice.vendorName,
    invoiceNumber: invoice.invoiceNumber,
    amount: String(invoice.amount),
    currency: invoice.currency,
    subtotal: String(invoice.subtotal),
    taxAmount: String(invoice.taxAmount),
    issueDate: invoice.issueDate ? invoice.issueDate.slice(0, 10) : '',
    dueDate: invoice.dueDate ? invoice.dueDate.slice(0, 10) : '',
    notes: invoice.notes,
  };
}

/**
 * Invoice detail: full field view with line items, inline editing, notes,
 * mark-as-paid with payment date, and deletion.
 */
export function InvoiceDetailPage(): JSX.Element {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const dateFormat = user?.settings.dateFormat ?? 'MM/DD/YYYY';

  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoices', 'detail', invoiceId],
    queryFn: async () => (await api.get<Invoice>(`/invoices/${invoiceId}`)).data,
    enabled: Boolean(invoiceId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const update = useMutation({
    mutationFn: async (state: EditState) =>
      (
        await api.patch<Invoice>(`/invoices/${invoiceId}`, {
          vendorName: state.vendorName.trim(),
          invoiceNumber: state.invoiceNumber.trim(),
          amount: Number(state.amount),
          currency: state.currency,
          subtotal: state.subtotal === '' ? 0 : Number(state.subtotal),
          taxAmount: state.taxAmount === '' ? 0 : Number(state.taxAmount),
          issueDate: state.issueDate || undefined,
          dueDate: state.dueDate || undefined,
          notes: state.notes,
        })
      ).data,
    onSuccess: () => {
      toast.success('Invoice updated');
      setEditing(false);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const markPaid = useMutation({
    mutationFn: () => api.post(`/invoices/${invoiceId}/mark-paid`, { paymentDate }),
    onSuccess: () => {
      toast.success('Marked as paid');
      setPayModalOpen(false);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/invoices/${invoiceId}`),
    onSuccess: () => {
      toast.success('Invoice deleted');
      invalidate();
      navigate('/invoices');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading || !invoice) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const startEditing = (): void => {
    setEdit(toEditState(invoice));
    setEditing(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/invoices"
            aria-label="Back to invoices"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{invoice.vendorName}</h1>
            <p className="text-slate-500 dark:text-slate-400">
              {invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : 'No invoice number'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {invoice.status !== 'paid' && (
            <Button onClick={() => setPayModalOpen(true)}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Mark as paid
            </Button>
          )}
          {editing ? (
            <Button variant="secondary" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" aria-hidden /> Cancel
            </Button>
          ) : (
            <Button variant="secondary" onClick={startEditing}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Button>
          )}
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </Button>
        </div>
      </div>

      <Card className="p-6">
        {editing && edit ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate(edit);
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Vendor name"
                value={edit.vendorName}
                onChange={(event) => setEdit({ ...edit, vendorName: event.target.value })}
                maxLength={200}
                required
              />
              <Input
                label="Invoice number"
                value={edit.invoiceNumber}
                onChange={(event) => setEdit({ ...edit, invoiceNumber: event.target.value })}
                maxLength={200}
              />
              <Input
                label="Amount"
                type="number"
                step="0.01"
                min={0}
                value={edit.amount}
                onChange={(event) => setEdit({ ...edit, amount: event.target.value })}
                required
              />
              <Select
                label="Currency"
                value={edit.currency}
                onChange={(event) => setEdit({ ...edit, currency: event.target.value })}
                options={CURRENCY_SELECT_OPTIONS}
              />
              <Input
                label="Subtotal"
                type="number"
                step="0.01"
                min={0}
                value={edit.subtotal}
                onChange={(event) => setEdit({ ...edit, subtotal: event.target.value })}
              />
              <Input
                label="Tax"
                type="number"
                step="0.01"
                min={0}
                value={edit.taxAmount}
                onChange={(event) => setEdit({ ...edit, taxAmount: event.target.value })}
              />
              <Input
                label="Issue date"
                type="date"
                value={edit.issueDate}
                onChange={(event) => setEdit({ ...edit, issueDate: event.target.value })}
              />
              <Input
                label="Due date"
                type="date"
                value={edit.dueDate}
                onChange={(event) => setEdit({ ...edit, dueDate: event.target.value })}
              />
            </div>
            <Textarea
              label="Notes"
              value={edit.notes}
              onChange={(event) => setEdit({ ...edit, notes: event.target.value })}
              maxLength={20000}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={update.isPending}>
                <Save className="h-4 w-4" aria-hidden /> Save changes
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={invoice.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Total amount</dt>
              <dd className="mt-1 text-xl font-bold">
                {formatCurrency(invoice.amount, invoice.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Due date</dt>
              <dd className="mt-1 font-medium">{formatDate(invoice.dueDate, dateFormat)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Issue date</dt>
              <dd className="mt-1 font-medium">{formatDate(invoice.issueDate, dateFormat)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Subtotal</dt>
              <dd className="mt-1 font-medium">
                {formatCurrency(invoice.subtotal, invoice.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Tax</dt>
              <dd className="mt-1 font-medium">
                {formatCurrency(invoice.taxAmount, invoice.currency)}
              </dd>
            </div>
            {invoice.paymentDate && (
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">Paid on</dt>
                <dd className="mt-1 font-medium">{formatDate(invoice.paymentDate, dateFormat)}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-slate-500 dark:text-slate-400">Source</dt>
              <dd className="mt-1 font-medium capitalize">{invoice.source}</dd>
            </div>
            {invoice.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap">{invoice.notes}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-semibold">Line items</h2>
        {invoice.lineItems.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">No line items on this invoice.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-4 font-medium">Description</th>
                  <th className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th className="py-2 pr-4 text-right font-medium">Unit price</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={index} className="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
                    <td className="py-2.5 pr-4">{item.description}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {formatCurrency(item.unitPrice, invoice.currency)}
                    </td>
                    <td className="py-2.5 text-right font-medium tabular-nums">
                      {formatCurrency(item.total, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Mark invoice as paid"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={markPaid.isPending} onClick={() => markPaid.mutate()}>
              Confirm payment
            </Button>
          </>
        }
      >
        <Input
          label="Payment date"
          type="date"
          value={paymentDate}
          onChange={(event) => setPaymentDate(event.target.value)}
        />
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this invoice?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p>
          The invoice from {invoice.vendorName} for{' '}
          {formatCurrency(invoice.amount, invoice.currency)} will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}
