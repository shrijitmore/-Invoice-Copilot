import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { NotificationsService } from './notifications.service';
import type { NotificationDocument } from './schemas/notification.schema';

/**
 * Notification bell API.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** Lists recent notifications (optionally unread only). */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<NotificationDocument[]> {
    return this.notificationsService.list(user.userId, unreadOnly === 'true');
  }

  /** Unread count for the bell badge. */
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ count: number }> {
    return { count: await this.notificationsService.unreadCount(user.userId) };
  }

  /** Marks a single notification read. */
  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationDocument> {
    return this.notificationsService.markRead(user.userId, id);
  }

  /** Marks all notifications read. */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<{ updated: number }> {
    return { updated: await this.notificationsService.markAllRead(user.userId) };
  }
}
