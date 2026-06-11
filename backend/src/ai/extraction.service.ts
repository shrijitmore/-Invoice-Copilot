import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { LlmProvider } from './llm.provider';

const lineItemSchema = z.object({
  description: z.string().describe('What was billed on this line'),
  quantity: z.number().describe('Quantity billed; 1 if not stated'),
  unitPrice: z.number().describe('Price per unit; equal to total if not stated'),
  total: z.number().describe('Line total'),
});

const invoiceExtractionSchema = z.object({
  vendorName: z
    .string()
    .describe('The company or person issuing the invoice (the party to be paid)'),
  invoiceNumber: z.string().nullable().describe('Invoice/reference number if present'),
  amount: z.number().nullable().describe('Grand total due, including tax'),
  currency: z
    .string()
    .nullable()
    .describe('ISO 4217 currency code such as USD, EUR, GBP, INR'),
  subtotal: z.number().nullable().describe('Pre-tax subtotal if shown'),
  taxAmount: z.number().nullable().describe('Total tax amount if shown'),
  issueDate: z.string().nullable().describe('Issue date in YYYY-MM-DD format'),
  dueDate: z.string().nullable().describe('Payment due date in YYYY-MM-DD format'),
  lineItems: z.array(lineItemSchema).describe('Every billed line item found'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Your confidence that the extraction is complete and correct'),
  ambiguities: z
    .array(z.string())
    .describe('Fields that were unclear or guessed, with a short human-readable reason each'),
});

/** Structured result of an AI invoice extraction. */
export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;

/** Extraction result enriched with timing metadata. */
export interface ExtractionResult {
  extraction: InvoiceExtraction;
  processingTimeMs: number;
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert accounts-payable clerk. Extract structured invoice
data exactly as it appears in the document. Rules:
- Never invent values. Use null for anything not present.
- Dates must be YYYY-MM-DD. Resolve ambiguous formats using context (due date is after issue date).
- Amounts are plain numbers without currency symbols or thousands separators.
- The vendor is the party ISSUING the invoice (to be paid), not the recipient.
- List every ambiguity (unclear vendor, guessed date format, unreadable totals) in "ambiguities".
- Set confidence below 0.6 when key fields (vendor, amount) were unclear.`;

/**
 * AI-powered structured extraction of invoice fields from raw text or
 * document images using OpenAI structured output.
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(private readonly llmProvider: LlmProvider) {}

  /**
   * Extracts invoice fields from plain text (pasted text or parsed PDF).
   *
   * @param text - Raw invoice text.
   * @returns Structured extraction with processing time.
   */
  async extractFromText(text: string): Promise<ExtractionResult> {
    return this.run([
      new SystemMessage(EXTRACTION_SYSTEM_PROMPT),
      new HumanMessage(`Extract the invoice data from this document:\n\n${text}`),
    ]);
  }

  /**
   * Extracts invoice fields from an image using the model's vision input.
   *
   * @param mimeType - Validated image MIME type.
   * @param buffer - Raw image bytes.
   * @returns Structured extraction with processing time.
   */
  async extractFromImage(mimeType: string, buffer: Buffer): Promise<ExtractionResult> {
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    return this.run([
      new SystemMessage(EXTRACTION_SYSTEM_PROMPT),
      new HumanMessage({
        content: [
          { type: 'text', text: 'Extract the invoice data from this document image.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }),
    ]);
  }

  private async run(messages: (SystemMessage | HumanMessage)[]): Promise<ExtractionResult> {
    const startedAt = Date.now();
    const model = this.llmProvider
      .createChatModel({ temperature: 0 })
      .withStructuredOutput(invoiceExtractionSchema, { name: 'extract_invoice' });

    try {
      const extraction = await model.invoke(messages);
      return { extraction, processingTimeMs: Date.now() - startedAt };
    } catch (error) {
      this.logger.error(`Invoice extraction failed: ${(error as Error).message}`);
      throw new UnprocessableEntityException(
        'The AI could not extract invoice data from this document. Try a clearer copy or paste the text directly.',
      );
    }
  }
}
