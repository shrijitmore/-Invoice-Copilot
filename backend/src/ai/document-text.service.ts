import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';

/**
 * Extracts plain text from uploaded invoice documents.
 */
@Injectable()
export class DocumentTextService {
  private readonly logger = new Logger(DocumentTextService.name);

  /**
   * Extracts text from a PDF buffer.
   *
   * @param buffer - Raw PDF bytes.
   * @returns The concatenated text content of every page.
   * @throws BadRequestException when the PDF is unreadable or contains no text.
   */
  async extractPdfText(buffer: Buffer): Promise<string> {
    let text: string;
    try {
      const result = await pdfParse(buffer);
      text = result.text.trim();
    } catch (error) {
      this.logger.warn(`PDF parsing failed: ${(error as Error).message}`);
      throw new BadRequestException('Could not read this PDF. Is the file corrupted?');
    }
    if (text.length === 0) {
      throw new BadRequestException(
        'This PDF contains no extractable text. Try uploading it as an image instead.',
      );
    }
    return text;
  }
}
