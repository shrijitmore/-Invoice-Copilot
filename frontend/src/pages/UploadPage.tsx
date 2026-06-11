import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardPaste, FileUp, Loader2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ExtractionReviewForm } from '../components/invoices/ExtractionReviewForm';
import { UploadDropzone } from '../components/invoices/UploadDropzone';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Textarea } from '../components/ui/Input';
import { api, getErrorMessage } from '../lib/api';
import { cn } from '../lib/utils';
import type { ExtractionResponse, FileExtractionOutcome } from '../types/api';

type Mode = 'upload' | 'paste';

/** One extraction queued for review. */
interface ReviewItem {
  label: string;
  data: ExtractionResponse;
}

/**
 * Upload workflow: drag-and-drop files (single or bulk) or paste raw text,
 * AI extraction with progress, then a review/edit step per invoice before
 * saving.
 */
export function UploadPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('upload');
  const [pasteText, setPasteText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [failures, setFailures] = useState<FileExtractionOutcome[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  const startReview = (items: ReviewItem[]): void => {
    setReviewQueue(items);
    setSavedCount(0);
  };

  const handleFiles = async (files: File[]): Promise<void> => {
    setExtracting(true);
    setFailures([]);
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }
      const { data } = await api.post<FileExtractionOutcome[]>('/invoices/extract/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180_000,
      });

      const successes = data.filter((outcome) => outcome.success && outcome.result);
      const failed = data.filter((outcome) => !outcome.success);
      setFailures(failed);

      if (successes.length === 0) {
        toast.error('No invoices could be read from those files.');
        return;
      }
      toast.success(
        `Extracted ${successes.length} invoice${successes.length > 1 ? 's' : ''} — review before saving`,
      );
      startReview(
        successes.map((outcome) => ({
          label: outcome.fileName,
          data: outcome.result as ExtractionResponse,
        })),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, 'Upload failed'));
    } finally {
      setExtracting(false);
    }
  };

  const handlePaste = async (): Promise<void> => {
    if (pasteText.trim().length < 20) {
      toast.error('Paste the full invoice text (at least 20 characters).');
      return;
    }
    setExtracting(true);
    try {
      const { data } = await api.post<ExtractionResponse>(
        '/invoices/extract/text',
        { text: pasteText },
        { timeout: 120_000 },
      );
      startReview([{ label: 'Pasted text', data }]);
      setPasteText('');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Extraction failed'));
    } finally {
      setExtracting(false);
    }
  };

  const onReviewSaved = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    setSavedCount((count) => count + 1);
    setReviewQueue((queue) => {
      const [, ...rest] = queue;
      if (rest.length === 0) {
        navigate('/invoices');
      }
      return rest;
    });
  };

  const onReviewCancelled = (): void => {
    setReviewQueue((queue) => {
      const [, ...rest] = queue;
      if (rest.length === 0 && savedCount > 0) {
        navigate('/invoices');
      }
      return rest;
    });
  };

  // Review step
  if (reviewQueue.length > 0) {
    const current = reviewQueue[0];
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold">Review extracted invoice</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {current.label}
            {reviewQueue.length > 1 && ` — ${reviewQueue.length - 1} more in the queue`}
          </p>
        </div>
        <Card className="p-6">
          <ExtractionReviewForm
            data={current.data}
            onSaved={onReviewSaved}
            onCancel={onReviewCancelled}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Add invoices</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Upload documents or paste text — the AI reads vendor, amounts, dates and line items.
        </p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Upload method">
        {(
          [
            { value: 'upload', label: 'Upload files', icon: FileUp },
            { value: 'paste', label: 'Paste text', icon: ClipboardPaste },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors',
              mode === value
                ? 'bg-navy-700 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <UploadDropzone onFiles={(files) => void handleFiles(files)} disabled={extracting} />
      ) : (
        <Card className="space-y-4 p-6">
          <Textarea
            label="Invoice text"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={'Paste the invoice contents here, for example:\n\nAcme Supplies\nInvoice #1042\nDue: July 15, 2026\nTotal: $1,250.00'}
            rows={10}
            maxLength={20000}
            disabled={extracting}
          />
          <div className="flex justify-end">
            <Button onClick={() => void handlePaste()} loading={extracting}>
              Extract invoice data
            </Button>
          </div>
        </Card>
      )}

      {extracting && (
        <Card className="flex items-center gap-3 p-5" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-navy-600" aria-hidden />
          <p>The AI is reading your invoice{mode === 'upload' ? 's' : ''}… this usually takes a few seconds.</p>
        </Card>
      )}

      {failures.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
            <XCircle className="h-5 w-5" aria-hidden />
            {failures.length} file{failures.length > 1 ? 's' : ''} could not be processed
          </h2>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {failures.map((failure) => (
              <li key={failure.fileName}>
                <span className="font-medium">{failure.fileName}</span>: {failure.error}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {savedCount > 0 && (
        <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          {savedCount} invoice{savedCount > 1 ? 's' : ''} saved this session
        </p>
      )}
    </div>
  );
}
