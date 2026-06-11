import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { InvoicesService } from './invoices.service';

/**
 * Hourly background job: flips unpaid invoices past their due date to
 * overdue, then emits due-soon and overdue notifications.
 */
@Injectable()
export class OverdueScheduler {
  private readonly logger = new Logger(OverdueScheduler.name);

  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Runs the overdue sweep and notification fan-out.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      await this.invoicesService.refreshOverdueStatuses();
      await this.notificationsService.generateInvoiceAlerts();
    } catch (error) {
      this.logger.error(`Overdue sweep failed: ${(error as Error).message}`);
    }
  }
}
