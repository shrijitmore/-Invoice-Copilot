import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_DATE_FORMATS,
  SupportedCurrency,
  SupportedDateFormat,
} from '../../common/constants/app.constants';

export enum UserRole {
  User = 'user',
  Admin = 'admin',
}

/**
 * Per-user preferences controlling display formats and notifications.
 */
@Schema({ _id: false })
export class UserSettings {
  @Prop({ type: String, enum: SUPPORTED_CURRENCIES, default: 'USD' })
  currency!: SupportedCurrency;

  @Prop({ type: String, enum: SUPPORTED_DATE_FORMATS, default: 'MM/DD/YYYY' })
  dateFormat!: SupportedDateFormat;

  @Prop({ type: Boolean, default: true })
  notifyDueSoon!: boolean;

  @Prop({ type: Boolean, default: true })
  notifyOverdue!: boolean;
}

const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);

/**
 * Application user, provisioned via Google OAuth.
 */
@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true, unique: true, index: true })
  googleId!: string;

  @Prop({ type: String, required: true, lowercase: true, unique: true, index: true })
  email!: string;

  @Prop({ type: String, required: true, maxlength: 200 })
  name!: string;

  /** Avatar as a data URI or external https URL from Google. */
  @Prop({ type: String, default: '' })
  avatarUrl!: string;

  @Prop({ type: String, enum: Object.values(UserRole), default: UserRole.User })
  role!: UserRole;

  @Prop({ type: UserSettingsSchema, default: () => ({}) })
  settings!: UserSettings;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
