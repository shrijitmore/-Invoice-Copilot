import { PartialType } from '@nestjs/mapped-types';
import { CreateInvoiceDto } from './create-invoice.dto';

/**
 * Partial invoice update: any subset of the create payload.
 */
export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}
