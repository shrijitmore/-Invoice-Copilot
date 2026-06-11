import { Injectable, Logger } from '@nestjs/common';
import { DocumentTextService } from '../ai/document-text.service';
import { ExtractionService, InvoiceExtraction } from '../ai/extraction.service';
import { InvoiceSource } from './schemas/invoice.schema';

/** Extraction result shaped for the review form on the frontend. */
export interface ExtractionResponse {
  extraction: InvoiceExtraction;
  source: InvoiceSource;
  rawText: string;
  processingTimeMs: number;
}

/** Per-file outcome of a bulk upload extraction. */
export interface FileExtractionOutcome {
  fileName: string;
  success: boolean;
  result?: ExtractionResponse;
  error?: string;
}

/**
 * Bridges uploaded documents and pasted text to the AI extraction
 * pipeline, normalizing per-file results for the review UI.
 */
@Injectable()
export class InvoiceExtractionService {
  private readonly logger = new Logger(InvoiceExtractionService.name);

  constructor(
    private readonly extractionService: ExtractionService,
    private readonly documentTextService: DocumentTextService,
  ) {}

  /**
   * Extracts invoice data from pasted text.
   *
   * @param text - Sanitized invoice text.
   */
  async extractFromText(text: string): Promise<ExtractionResponse> {
    const { extraction, processingTimeMs } = await this.extractionService.extractFromText(text);
    return { extraction, source: InvoiceSource.Text, rawText: text, processingTimeMs };
  }

  /**
   * Extracts invoice data from each uploaded file independently, so one
   * bad file never fails the whole batch.
   *
   * @param files - Pre-validated uploads (type and size already checked).
   */
  async extractFromFiles(files: Express.Multer.File[]): Promise<FileExtractionOutcome[]> {
    return Promise.all(
      files.map(async (file): Promise<FileExtractionOutcome> => {
        try {
          const result =
            file.mimetype === 'application/pdf'
              ? await this.extractPdf(file)
              : await this.extractImage(file);
          return { fileName: file.originalname, success: true, result };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Extraction failed for this file';
          this.logger.warn(`Extraction failed for upload: ${message}`);
          return { fileName: file.originalname, success: false, error: message };
        }
      }),
    );
  }

  private async extractPdf(file: Express.Multer.File): Promise<ExtractionResponse> {
    const text = await this.documentTextService.extractPdfText(file.buffer);
    const { extraction, processingTimeMs } = await this.extractionService.extractFromText(text);
    return {
      extraction,
      source: InvoiceSource.Pdf,
      rawText: text.slice(0, 50_000),
      processingTimeMs,
    };
  }

  private async extractImage(file: Express.Multer.File): Promise<ExtractionResponse> {
    const { extraction, processingTimeMs } = await this.extractionService.extractFromImage(
      file.mimetype,
      file.buffer,
    );
    return { extraction, source: InvoiceSource.Image, rawText: '', processingTimeMs };
  }
}
