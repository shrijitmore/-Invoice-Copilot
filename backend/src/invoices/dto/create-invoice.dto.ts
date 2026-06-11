import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MAX_SHORT_TEXT_LENGTH,
  MAX_TEXT_LENGTH,
} from '../../common/constants/app.constants';
import { SanitizedString } from '../../common/decorators/sanitized-string.decorator';
import { InvoiceSource, InvoiceStatus } from '../schemas/invoice.schema';
import { LineItemDto } from './line-item.dto';

/**
 * Payload for saving an invoice — either reviewed AI-extracted data or a
 * manual entry.
 */
export class CreateInvoiceDto {
  @SanitizedString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  vendorName!: string;

  @SanitizedString()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  invoiceNumber?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @SanitizedString()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems?: LineItemDto[];

  @SanitizedString()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXT_LENGTH)
  notes?: string;

  @SanitizedString()
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  rawText?: string;

  @IsOptional()
  @IsEnum(InvoiceSource)
  source?: InvoiceSource;

  @IsOptional()
  @IsInt()
  @Min(0)
  processingTimeMs?: number;
}
