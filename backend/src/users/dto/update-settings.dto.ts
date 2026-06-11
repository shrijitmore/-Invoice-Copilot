import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_DATE_FORMATS,
  SupportedCurrency,
  SupportedDateFormat,
} from '../../common/constants/app.constants';

/**
 * Partial update of user preferences; only provided fields change.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  currency?: SupportedCurrency;

  @IsOptional()
  @IsIn(SUPPORTED_DATE_FORMATS)
  dateFormat?: SupportedDateFormat;

  @IsOptional()
  @IsBoolean()
  notifyDueSoon?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOverdue?: boolean;
}
