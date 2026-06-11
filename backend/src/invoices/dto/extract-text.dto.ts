import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_TEXT_LENGTH } from '../../common/constants/app.constants';
import { SanitizedString } from '../../common/decorators/sanitized-string.decorator';

/**
 * Raw invoice text pasted by the user for AI extraction.
 */
export class ExtractTextDto {
  @SanitizedString()
  @IsString()
  @IsNotEmpty()
  @MinLength(20, { message: 'Please paste the full invoice text (at least 20 characters)' })
  @MaxLength(MAX_TEXT_LENGTH)
  text!: string;
}
