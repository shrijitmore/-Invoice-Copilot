import { useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useDebounce } from '../../hooks/useDebounce';
import { api, getErrorMessage } from '../../lib/api';
import { CURRENCY_SELECT_OPTIONS } from '../../lib/constants';
import type {
  DuplicateCheckResult,
  ExtractionResponse,
  Invoice,
  InvoiceLineItem,
} from '../../types/api';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';

interface FormState {
  vendorName: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  lineItems: InvoiceLineItem[];
}

export interface ExtractionReviewFormProps {
  /**
   * AI extraction to prefill from. Render with a `key` per extraction so
   * the form state resets naturally between queue items.
   */
  data: ExtractionResponse;
  /** Called with the saved invoice. */
  onSaved: (invoice: Invoice) => void;
  onCancel: () => void;
}

function toFormState(data: ExtractionResponse): FormState {
  const { extraction } = data;
  return {
    vendorName: extraction.vendorName ?? '',
    invoiceNumber: extraction.invoiceNumber ?? '',
    amount: extraction.amount !== null ? String(extraction.amount) : '',
    currency: extraction.currency ?? 'USD',
    subtotal: extraction.subtotal !== null ? String(extraction.subtotal) : '',
    taxAmount: extraction.taxAmount !== null ? String(extraction.taxAmount) : '',
    issueDate: extraction.issueDate ?? '',
    dueDate: extraction.dueDate ?? '',
    notes: '',
    lineItems: extraction.lineItems ?? [],
  };
}

/**
 * Review/edit screen for AI-extracted invoice fields before saving:
 * surfaces extraction ambiguities, warns about duplicates (same vendor +
 * amount) and allows full line-item editing.
 */
export function ExtractionReviewForm({ data, onSaved, onCancel }: ExtractionReviewFormProps): JSX.Element {
  const [form, setForm] = useState<FormState>(() => toFormState(data));

  // Duplicate probe: declarative query keyed on the debounced vendor+amount.
  const probeVendor = useDebounce(form.vendorName.trim(), 400);
  const probeAmount = Number(useDebounce(form.amount, 400));
  const probeEnabled = probeVendor.length > 0 && Number.isFinite(probeAmount) && probeAmount > 0;
  const { data: duplicate } = useQuery({
    queryKey: ['invoices', 'duplicate-check', probeVendor, probeAmount],
    queryFn: async () =>
      (
        await api.post<DuplicateCheckResult>('/invoices/check-duplicate', {
          vendorName: probeVendor,
          amount: probeAmount,
        })
      ).data,
    enabled: probeEnabled,
    staleTime: 60_000,
  });

  const set = (patch: Partial<FormState>): void => setForm((current) => ({ ...current, ...patch }));

  const setLineItem = (index: number, patch: Partial<InvoiceLineItem>): void => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        vendorName: form.vendorName.trim(),
        invoiceNumber: form.invoiceNumber.trim() || undefined,
        amount: Number(form.amount),
        currency: form.currency,
        subtotal: form.subtotal === '' ? undefined : Number(form.subtotal),
        taxAmount: form.taxAmount === '' ? undefined : Number(form.taxAmount),
        issueDate: form.issueDate || undefined,
        dueDate: form.dueDate || undefined,
        notes: form.notes.trim() || undefined,
        lineItems: form.lineItems,
        rawText: data.rawText || undefined,
        source: data.source,
        processingTimeMs: data.processingTimeMs,
      };
      return (await api.post<Invoice>('/invoices', payload)).data;
    },
    onSuccess: (invoice) => {
      toast.success(`Invoice from ${invoice.vendorName} saved`);
      onSaved(invoice);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const amountValid = Number.isFinite(Number(form.amount)) && Number(form.amount) >= 0 && form.amount !== '';
  const canSave = form.vendorName.trim().length > 0 && amountValid;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) {
          save.mutate();
        }
      }}
      className="space-y-5"
    >
      {data.extraction.ambiguities.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/30">
          <p className="mb-1 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            The AI wasn't sure about some fields — please double-check:
          </p>
          <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-300">
            {data.extraction.ambiguities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {probeEnabled && duplicate?.isDuplicate && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/30">
          <p className="flex items-center gap-2 font-medium text-red-800 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Possible duplicate: you already have {duplicate.matches.length} invoice
            {duplicate.matches.length > 1 ? 's' : ''} from this vendor for the same amount.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Vendor name *"
          value={form.vendorName}
          onChange={(event) => set({ vendorName: event.target.value })}
          maxLength={200}
          required
        />
        <Input
          label="Invoice number"
          value={form.invoiceNumber}
          onChange={(event) => set({ invoiceNumber: event.target.value })}
          maxLength={200}
        />
        <Input
          label="Total amount *"
          type="number"
          step="0.01"
          min={0}
          value={form.amount}
          onChange={(event) => set({ amount: event.target.value })}
          required
          error={form.amount !== '' && !amountValid ? 'Enter a valid amount' : undefined}
        />
        <Select
          label="Currency"
          value={form.currency}
          onChange={(event) => set({ currency: event.target.value })}
          options={CURRENCY_SELECT_OPTIONS}
        />
        <Input
          label="Subtotal"
          type="number"
          step="0.01"
          min={0}
          value={form.subtotal}
          onChange={(event) => set({ subtotal: event.target.value })}
        />
        <Input
          label="Tax amount"
          type="number"
          step="0.01"
          min={0}
          value={form.taxAmount}
          onChange={(event) => set({ taxAmount: event.target.value })}
        />
        <Input
          label="Issue date"
          type="date"
          value={form.issueDate}
          onChange={(event) => set({ issueDate: event.target.value })}
        />
        <Input
          label="Due date"
          type="date"
          value={form.dueDate}
          onChange={(event) => set({ dueDate: event.target.value })}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">Line items</h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setForm((current) => ({
                ...current,
                lineItems: [
                  ...current.lineItems,
                  { description: '', quantity: 1, unitPrice: 0, total: 0 },
                ],
              }))
            }
          >
            <Plus className="h-4 w-4" aria-hidden /> Add line
          </Button>
        </div>
        {form.lineItems.length === 0 ? (
          <p className="text-sm text-slate-500">No line items extracted.</p>
        ) : (
          <div className="space-y-2">
            {form.lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_70px_90px_90px_40px] items-center gap-2">
                <Input
                  aria-label={`Line ${index + 1} description`}
                  placeholder="Description"
                  value={item.description}
                  onChange={(event) => setLineItem(index, { description: event.target.value })}
                  maxLength={500}
                />
                <Input
                  aria-label={`Line ${index + 1} quantity`}
                  type="number"
                  min={0}
                  step="any"
                  value={item.quantity}
                  onChange={(event) => setLineItem(index, { quantity: Number(event.target.value) })}
                />
                <Input
                  aria-label={`Line ${index + 1} unit price`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) => setLineItem(index, { unitPrice: Number(event.target.value) })}
                />
                <Input
                  aria-label={`Line ${index + 1} total`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.total}
                  onChange={(event) => setLineItem(index, { total: Number(event.target.value) })}
                />
                <button
                  type="button"
                  aria-label={`Remove line ${index + 1}`}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      lineItems: current.lineItems.filter((_, i) => i !== index),
                    }))
                  }
                  className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Textarea
        label="Notes"
        value={form.notes}
        onChange={(event) => set({ notes: event.target.value })}
        placeholder="Anything to remember about this invoice"
        maxLength={20000}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSave} loading={save.isPending}>
          Save invoice
        </Button>
      </div>
    </form>
  );
}
