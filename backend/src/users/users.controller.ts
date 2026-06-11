import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_BYTES,
  REFRESH_TOKEN_COOKIE,
} from '../common/constants/app.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AccountStats, UserProfile, UsersService } from './users.service';

/**
 * Self-service profile endpoints (the authenticated user's own account).
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Returns the current user's profile. */
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return this.usersService.getProfile(user.userId);
  }

  /** Updates the current user's display name. */
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.usersService.updateProfile(user.userId, dto);
  }

  /** Uploads a new avatar image (png/jpeg/webp, max 2 MB). */
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: MAX_AVATAR_BYTES } }))
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UserProfile> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!(ALLOWED_AVATAR_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException('Avatar must be a PNG, JPEG or WebP image');
    }
    return this.usersService.updateAvatar(user.userId, file.mimetype, file.buffer);
  }

  /** Updates preferences (currency, date format, notifications). */
  @Patch('me/settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<UserProfile> {
    return this.usersService.updateSettings(user.userId, dto);
  }

  /** Returns account statistics for the profile page. */
  @Get('me/stats')
  getStats(@CurrentUser() user: AuthenticatedUser): Promise<AccountStats> {
    return this.usersService.getStats(user.userId);
  }

  /** Danger zone: wipes all invoices, chats and notifications. */
  @Delete('me/data')
  @HttpCode(HttpStatus.OK)
  async deleteAllData(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true }> {
    await this.usersService.deleteAllData(user.userId);
    return { success: true };
  }

  /** Danger zone: permanently deletes the account and ends the session. */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    await this.usersService.deleteAccount(user.userId);
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
    return { success: true };
  }
}
