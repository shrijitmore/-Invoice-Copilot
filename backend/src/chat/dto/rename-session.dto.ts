import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_SHORT_TEXT_LENGTH } from '../../common/constants/app.constants';
import { SanitizedString } from '../../common/decorators/sanitized-string.decorator';

/**
 * Payload for renaming a chat session.
 */
export class RenameSessionDto {
  @SanitizedString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  title!: string;
}
