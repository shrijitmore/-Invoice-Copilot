import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_CHAT_MESSAGE_LENGTH } from '../../common/constants/app.constants';
import { SanitizedString } from '../../common/decorators/sanitized-string.decorator';

/**
 * A user message sent to the AI copilot.
 */
export class SendMessageDto {
  @SanitizedString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CHAT_MESSAGE_LENGTH)
  content!: string;
}
