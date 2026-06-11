import { Module } from '@nestjs/common';
import { DocumentTextService } from './document-text.service';
import { ExtractionService } from './extraction.service';
import { LlmProvider } from './llm.provider';

/**
 * Low-level AI capabilities shared by invoices (extraction) and chat
 * (agent): model factory, document parsing, structured extraction.
 */
@Module({
  providers: [LlmProvider, DocumentTextService, ExtractionService],
  exports: [LlmProvider, DocumentTextService, ExtractionService],
})
export class AiModule {}
