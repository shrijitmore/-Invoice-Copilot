import { IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { MAX_SHORT_TEXT_LENGTH } from '../../common/constants/app.constants';
import { SanitizedString } from '../../common/decorators/sanitized-string.decorator';

/**
 * Pre-save duplicate probe: same vendor + same amount.
 */
export class CheckDuplicateDto {
  @SanitizedString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  vendorName!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}
