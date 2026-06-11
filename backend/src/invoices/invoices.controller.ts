import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ALLOWED_INVOICE_MIME_TYPES,
  MAX_BULK_FILES,
  MAX_UPLOAD_BYTES,
} from '../common/constants/app.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BulkIdsDto } from './dto/bulk-ids.dto';
import { CheckDuplicateDto } from './dto/check-duplicate.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ExtractTextDto } from './dto/extract-text.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { FileExtractionOutcome, InvoiceExtractionService } from './invoice-extraction.service';
import type { ExtractionResponse } from './invoice-extraction.service';
import {
  DuplicateCheckResult,
  InvoicesService,
  PaginatedInvoices,
} from './invoices.service';
import type { InvoiceDocument } from './schemas/invoice.schema';

/**
 * Invoice REST API: CRUD, AI extraction, duplicate checks and CSV export.
 * All routes operate strictly on the authenticated user's own data.
 */
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly extractionService: InvoiceExtractionService,
  ) {}

  /** Saves a reviewed/manual invoice. */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvoiceDto,
  ): Promise<InvoiceDocument> {
    return this.invoicesService.create(user.userId, dto);
  }

  /** Runs AI extraction on pasted invoice text. */
  @Post('extract/text')
  extractFromText(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ExtractTextDto,
  ): Promise<ExtractionResponse> {
    return this.extractionService.extractFromText(dto.text);
  }

  /**
   * Runs AI extraction on uploaded documents (PDF or image, max 10 MB
   * each, up to 10 files). Returns one outcome per file so bulk uploads
   * report per-file successes and failures.
   */
  @Post('extract/files')
  @UseInterceptors(FilesInterceptor('files', MAX_BULK_FILES, { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  extractFromFiles(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<FileExtractionOutcome[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    for (const file of files) {
      if (!(ALLOWED_INVOICE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
        throw new BadRequestException(
          `"${file.originalname}" is not supported. Upload PDF, PNG, JPEG or WebP files only.`,
        );
      }
    }
    return this.extractionService.extractFromFiles(files);
  }

  /** Lists invoices with filters, search, sorting and pagination. */
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryInvoicesDto,
  ): Promise<PaginatedInvoices> {
    return this.invoicesService.findAll(user.userId, query);
  }

  /** Distinct vendor names for filter dropdowns. */
  @Get('vendors')
  listVendors(@CurrentUser() user: AuthenticatedUser): Promise<string[]> {
    return this.invoicesService.listVendors(user.userId);
  }

  /** Exports (optionally filtered) invoices as a CSV download. */
  @Get('export/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="invoices.csv"')
  exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryInvoicesDto,
  ): Promise<string> {
    return this.invoicesService.exportCsv(user.userId, query);
  }

  /** Warns about potential duplicates before saving. */
  @Post('check-duplicate')
  @HttpCode(HttpStatus.OK)
  checkDuplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckDuplicateDto,
  ): Promise<DuplicateCheckResult> {
    return this.invoicesService.checkDuplicate(user.userId, dto);
  }

  /** Bulk-deletes invoices by id. */
  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  async bulkDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkIdsDto,
  ): Promise<{ deleted: number }> {
    const deleted = await this.invoicesService.bulkRemove(user.userId, dto);
    return { deleted };
  }

  /** Loads one invoice with full line items. */
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<InvoiceDocument> {
    return this.invoicesService.findOne(user.userId, id);
  }

  /** Applies a partial update (fields, notes, line items). */
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ): Promise<InvoiceDocument> {
    return this.invoicesService.update(user.userId, id, dto);
  }

  /** Marks the invoice paid. */
  @Post(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  markPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
  ): Promise<InvoiceDocument> {
    return this.invoicesService.markPaid(user.userId, id, dto);
  }

  /** Deletes one invoice. */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.invoicesService.remove(user.userId, id);
    return { success: true };
  }
}
