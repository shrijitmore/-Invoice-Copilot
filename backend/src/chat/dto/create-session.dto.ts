import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_SHORT_TEXT_LENGTH } from '../../common/constants/app.constants';
import { SanitizedString } from '../../common/decorators/sanitized-string.decorator';

/**
 * Payload for starting a new chat session.
 */
export class CreateSessionDto {
  @SanitizedString()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  title?: string;
}
