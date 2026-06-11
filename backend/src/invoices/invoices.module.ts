import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoiceExtractionService } from './invoice-extraction.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { OverdueScheduler } from './overdue.scheduler';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';

/**
 * Invoice management: CRUD, AI extraction, exports and the overdue sweep.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }]),
    AiModule,
    NotificationsModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceExtractionService, OverdueScheduler],
  exports: [InvoicesService],
})
export class InvoicesModule {}
