import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DUE_SOON_DAYS } from '../common/constants/app.constants';
import { addDays, daysBetween, startOfDay } from '../common/utils/date.util';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';

/**
 * In-app notifications: querying, read-state management and the scheduled
 * generation of due-soon / overdue invoice alerts.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Lists the user's most recent notifications.
   *
   * @param userId - Owning user id.
   * @param unreadOnly - When true, returns only unread items.
   */
  async list(userId: string, unreadOnly: boolean): Promise<NotificationDocument[]> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (unreadOnly) {
      filter.read = false;
    }
    return this.notificationModel.find(filter).sort({ createdAt: -1 }).limit(50).exec();
  }

  /**
   * Counts unread notifications for the bell badge.
   */
  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId: new Types.ObjectId(userId), read: false })
      .exec();
  }

  /**
   * Marks one notification read.
   *
   * @throws NotFoundException when missing or not owned by the user.
   */
  async markRead(userId: string, notificationId: string): Promise<NotificationDocument> {
    const notification = Types.ObjectId.isValid(notificationId)
      ? await this.notificationModel
          .findOneAndUpdate(
            { _id: notificationId, userId: new Types.ObjectId(userId) },
            { $set: { read: true } },
            { new: true },
          )
          .exec()
      : null;
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }

  /**
   * Marks every notification read for the user.
   *
   * @returns Number of notifications updated.
   */
  async markAllRead(userId: string): Promise<number> {
    const result = await this.notificationModel
      .updateMany({ userId: new Types.ObjectId(userId), read: false }, { $set: { read: true } })
      .exec();
    return result.modifiedCount;
  }

  /**
   * Scheduled fan-out: creates due-soon (within {@link DUE_SOON_DAYS} days)
   * and overdue alerts for every user that has them enabled. Dedupe keys
   * guarantee at most one alert per invoice per type.
   */
  async generateInvoiceAlerts(): Promise<void> {
    const today = startOfDay(new Date());
    const dueSoonCutoff = addDays(today, DUE_SOON_DAYS);

    const [dueSoon, overdue] = await Promise.all([
      this.invoiceModel
        .find({ status: InvoiceStatus.Unpaid, dueDate: { $gte: today, $lte: dueSoonCutoff } })
        .exec(),
      this.invoiceModel.find({ status: InvoiceStatus.Overdue }).exec(),
    ]);

    const userIds = [
      ...new Set([...dueSoon, ...overdue].map((inv) => inv.userId.toString())),
    ].map((id) => new Types.ObjectId(id));
    const users = await this.userModel.find({ _id: { $in: userIds } }).exec();
    const userById = new Map(users.map((user) => [user._id.toString(), user]));

    for (const invoice of dueSoon) {
      const user = userById.get(invoice.userId.toString());
      if (!user || !user.settings.notifyDueSoon || !invoice.dueDate) {
        continue;
      }
      const days = daysBetween(today, invoice.dueDate);
      const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
      await this.createIfAbsent(invoice.userId, {
        type: NotificationType.DueSoon,
        title: 'Invoice due soon',
        message: `${invoice.vendorName} — ${invoice.currency} ${invoice.amount.toFixed(2)} is due ${when}.`,
        invoiceId: invoice._id,
        dedupeKey: `due_soon:${invoice._id.toString()}`,
      });
    }

    for (const invoice of overdue) {
      const user = userById.get(invoice.userId.toString());
      if (!user || !user.settings.notifyOverdue) {
        continue;
      }
      await this.createIfAbsent(invoice.userId, {
        type: NotificationType.Overdue,
        title: 'Invoice overdue',
        message: `${invoice.vendorName} — ${invoice.currency} ${invoice.amount.toFixed(2)} is past its due date.`,
        invoiceId: invoice._id,
        dedupeKey: `overdue:${invoice._id.toString()}`,
      });
    }
  }

  private async createIfAbsent(
    userId: Types.ObjectId,
    data: {
      type: NotificationType;
      title: string;
      message: string;
      invoiceId: Types.ObjectId;
      dedupeKey: string;
    },
  ): Promise<void> {
    try {
      await this.notificationModel.updateOne(
        { userId, dedupeKey: data.dedupeKey },
        { $setOnInsert: { userId, read: false, ...data } },
        { upsert: true },
      );
    } catch (error) {
      // Unique-index races between concurrent sweeps are harmless.
      this.logger.debug(`Notification upsert skipped: ${(error as Error).message}`);
    }
  }
}
