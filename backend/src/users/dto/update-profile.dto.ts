import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_SHORT_TEXT_LENGTH } from '../../common/constants/app.constants';
import { SanitizedString } from '../../common/decorators/sanitized-string.decorator';

/**
 * Payload for editing the user's display profile.
 */
export class UpdateProfileDto {
  @SanitizedString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SHORT_TEXT_LENGTH)
  name!: string;
}
