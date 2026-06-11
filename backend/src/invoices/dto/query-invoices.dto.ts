import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_SHORT_TEXT_LENGTH } from '../../common/constants/app.constants';
import { SanitizedString } from '../../common/decorators/sanitized-string.decorator';
import { InvoiceStatus } from '../schemas/invoice.schema';

export const INVOICE_SORT_FIELDS = [
  'vendorName',
  'amount',
  'dueDate',
  'issueDate',
  'status',
  'createdAt',
] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

/**
 * List query: filtering, search, sorting and pagination for invoices.
 */
export class QueryInvoicesDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @SanitizedString()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  vendor?: string;

  /** Matches vendor name or invoice number, case-insensitive. */
  @SanitizedString()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsIn(INVOICE_SORT_FIELDS)
  sortBy?: InvoiceSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
