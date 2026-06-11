import { IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { SanitizedString } from '../../common/decorators/sanitized-string.decorator';

/**
 * A single invoice line item as submitted by the client.
 */
export class LineItemDto {
  @SanitizedString()
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  total!: number;
}
