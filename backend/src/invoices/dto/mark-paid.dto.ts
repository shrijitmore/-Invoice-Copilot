import { IsDateString, IsOptional } from 'class-validator';

/**
 * Payload for marking an invoice as paid.
 */
export class MarkPaidDto {
  /** Payment date (ISO); defaults to now when omitted. */
  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}
