import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ACCEPTED_INVOICE_MIME_TYPES,
  MAX_BULK_FILES,
  MAX_UPLOAD_BYTES,
} from '../../lib/constants';
import { cn } from '../../lib/utils';

export interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Drag-and-drop + click-to-browse upload area for invoice documents.
 * Validates type (PDF/PNG/JPEG/WebP), size (≤10 MB) and count (≤10) client
 * side before handing files up.
 */
export function UploadDropzone({ onFiles, disabled = false }: UploadDropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = (incoming: FileList | null): void => {
    if (!incoming || disabled) {
      return;
    }
    const files = Array.from(incoming);
    if (files.length > MAX_BULK_FILES) {
      toast.error(`You can upload up to ${MAX_BULK_FILES} files at once.`);
      return;
    }
    const valid: File[] = [];
    for (const file of files) {
      if (!ACCEPTED_INVOICE_MIME_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" isn't supported. Use PDF, PNG, JPEG or WebP.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`"${file.name}" is over 10 MB.`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) {
      onFiles(valid);
    }
  };

  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    setDragging(false);
    acceptFiles(event.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload invoice files"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
        dragging
          ? 'border-navy-500 bg-navy-50 dark:bg-navy-800/40'
          : 'border-slate-300 bg-white hover:border-navy-400 dark:border-slate-600 dark:bg-slate-800',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <UploadCloud className="mb-3 h-10 w-10 text-navy-500" aria-hidden />
      <p className="mb-1 text-base font-medium">
        Drag &amp; drop invoices here, or <span className="text-navy-600 underline dark:text-navy-300">browse</span>
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        PDF, PNG, JPEG or WebP — up to 10 MB each, 10 files max
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          acceptFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
