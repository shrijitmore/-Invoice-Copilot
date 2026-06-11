import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { escapeRegex } from '../common/utils/sanitize.util';
import { toCsv } from '../common/utils/csv.util';
import { startOfDay } from '../common/utils/date.util';
import type { BulkIdsDto } from './dto/bulk-ids.dto';
import type { CheckDuplicateDto } from './dto/check-duplicate.dto';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { MarkPaidDto } from './dto/mark-paid.dto';
import type { QueryInvoicesDto } from './dto/query-invoices.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Invoice, InvoiceDocument, InvoiceSource, InvoiceStatus } from './schemas/invoice.schema';

/** Paginated invoice list response. */
export interface PaginatedInvoices {
  items: InvoiceDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Result of a duplicate probe. */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches: Array<{ id: string; vendorName: string; amount: number; createdAt: Date }>;
}

const CSV_HEADERS = [
  'Vendor',
  'Invoice Number',
  'Amount',
  'Currency',
  'Subtotal',
  'Tax',
  'Issue Date',
  'Due Date',
  'Status',
  'Payment Date',
  'Notes',
] as const;

/**
 * Core invoice domain logic: CRUD, filtering, duplicate detection, overdue
 * transitions and CSV export. Every query is scoped to the owning user.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
  ) {}

  /**
   * Persists a new invoice for a user.
   *
   * @param userId - Owning user id.
   * @param dto - Validated invoice payload.
   * @returns The created document.
   */
  async create(userId: string, dto: CreateInvoiceDto): Promise<InvoiceDocument> {
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    let status = dto.status ?? InvoiceStatus.Unpaid;
    if (status !== InvoiceStatus.Paid && dueDate && dueDate < startOfDay(new Date())) {
      status = InvoiceStatus.Overdue;
    }

    return this.invoiceModel.create({
      userId: new Types.ObjectId(userId),
      vendorName: dto.vendorName,
      invoiceNumber: dto.invoiceNumber ?? '',
      amount: dto.amount,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      subtotal: dto.subtotal ?? 0,
      taxAmount: dto.taxAmount ?? 0,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
      dueDate,
      status,
      paymentDate: status === InvoiceStatus.Paid ? new Date() : null,
      lineItems: dto.lineItems ?? [],
      notes: dto.notes ?? '',
      rawText: dto.rawText ?? '',
      source: dto.source ?? InvoiceSource.Manual,
      processingTimeMs: dto.processingTimeMs ?? 0,
    });
  }

  /**
   * Lists invoices with filtering, search, sorting and pagination. Overdue
   * statuses are refreshed first so results are always current.
   *
   * @param userId - Owning user id.
   * @param query - Validated query parameters.
   */
  async findAll(userId: string, query: QueryInvoicesDto): Promise<PaginatedInvoices> {
    await this.refreshOverdueStatuses(userId);

    const filter = this.buildFilter(userId, query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .sort({ [sortBy]: sortOrder, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.invoiceModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /**
   * Loads a single invoice owned by the user.
   *
   * @throws NotFoundException when missing or owned by someone else.
   */
  async findOne(userId: string, invoiceId: string): Promise<InvoiceDocument> {
    const invoice = Types.ObjectId.isValid(invoiceId)
      ? await this.invoiceModel
          .findOne({ _id: invoiceId, userId: new Types.ObjectId(userId) })
          .exec()
      : null;
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  /**
   * Applies a partial update to an invoice, recomputing status when due
   * date changes.
   */
  async update(userId: string, invoiceId: string, dto: UpdateInvoiceDto): Promise<InvoiceDocument> {
    const invoice = await this.findOne(userId, invoiceId);

    if (dto.vendorName !== undefined) invoice.vendorName = dto.vendorName;
    if (dto.invoiceNumber !== undefined) invoice.invoiceNumber = dto.invoiceNumber;
    if (dto.amount !== undefined) invoice.amount = dto.amount;
    if (dto.currency !== undefined) invoice.currency = dto.currency.toUpperCase();
    if (dto.subtotal !== undefined) invoice.subtotal = dto.subtotal;
    if (dto.taxAmount !== undefined) invoice.taxAmount = dto.taxAmount;
    if (dto.issueDate !== undefined) invoice.issueDate = dto.issueDate ? new Date(dto.issueDate) : null;
    if (dto.dueDate !== undefined) invoice.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.lineItems !== undefined) invoice.lineItems = dto.lineItems;
    if (dto.notes !== undefined) invoice.notes = dto.notes;
    if (dto.status !== undefined) {
      invoice.status = dto.status;
      if (dto.status !== InvoiceStatus.Paid) {
        invoice.paymentDate = null;
      }
    }

    // Re-derive overdue state from the (possibly new) due date.
    if (invoice.status !== InvoiceStatus.Paid) {
      invoice.status =
        invoice.dueDate && invoice.dueDate < startOfDay(new Date())
          ? InvoiceStatus.Overdue
          : InvoiceStatus.Unpaid;
    }

    return invoice.save();
  }

  /**
   * Marks an invoice paid with the given (or current) payment date.
   */
  async markPaid(userId: string, invoiceId: string, dto: MarkPaidDto): Promise<InvoiceDocument> {
    const invoice = await this.findOne(userId, invoiceId);
    invoice.status = InvoiceStatus.Paid;
    invoice.paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    return invoice.save();
  }

  /**
   * Deletes a single invoice.
   */
  async remove(userId: string, invoiceId: string): Promise<void> {
    const invoice = await this.findOne(userId, invoiceId);
    await invoice.deleteOne();
  }

  /**
   * Deletes a batch of invoices owned by the user.
   *
   * @returns Number of invoices removed.
   */
  async bulkRemove(userId: string, dto: BulkIdsDto): Promise<number> {
    const result = await this.invoiceModel
      .deleteMany({
        _id: { $in: dto.ids.map((id) => new Types.ObjectId(id)) },
        userId: new Types.ObjectId(userId),
      })
      .exec();
    return result.deletedCount;
  }

  /**
   * Checks whether an invoice with the same vendor (case-insensitive) and
   * amount already exists — used to warn before saving duplicates.
   */
  async checkDuplicate(userId: string, dto: CheckDuplicateDto): Promise<DuplicateCheckResult> {
    const matches = await this.invoiceModel
      .find({
        userId: new Types.ObjectId(userId),
        vendorName: new RegExp(`^${escapeRegex(dto.vendorName)}$`, 'i'),
        amount: dto.amount,
      })
      .limit(5)
      .exec();

    return {
      isDuplicate: matches.length > 0,
      matches: matches.map((m) => ({
        id: m._id.toString(),
        vendorName: m.vendorName,
        amount: m.amount,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Lists the user's distinct vendor names for filter dropdowns.
   */
  async listVendors(userId: string): Promise<string[]> {
    const vendors = await this.invoiceModel
      .distinct('vendorName', { userId: new Types.ObjectId(userId) })
      .exec();
    return vendors.sort((a, b) => a.localeCompare(b));
  }

  /**
   * Serializes the user's invoices (optionally filtered) to CSV.
   */
  async exportCsv(userId: string, query: QueryInvoicesDto): Promise<string> {
    await this.refreshOverdueStatuses(userId);
    const filter = this.buildFilter(userId, query);
    const invoices = await this.invoiceModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(10_000)
      .exec();

    const rows = invoices.map((inv) => [
      inv.vendorName,
      inv.invoiceNumber,
      inv.amount,
      inv.currency,
      inv.subtotal,
      inv.taxAmount,
      inv.issueDate ? inv.issueDate.toISOString().slice(0, 10) : '',
      inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '',
      inv.status,
      inv.paymentDate ? inv.paymentDate.toISOString().slice(0, 10) : '',
      inv.notes,
    ]);

    return toCsv(CSV_HEADERS, rows);
  }

  /**
   * Transitions unpaid invoices past their due date to overdue. Scoped to a
   * user when provided; global when run by the scheduler.
   *
   * @param userId - Optional user scope.
   * @returns Number of invoices transitioned.
   */
  async refreshOverdueStatuses(userId?: string): Promise<number> {
    const filter: FilterQuery<InvoiceDocument> = {
      status: InvoiceStatus.Unpaid,
      dueDate: { $ne: null, $lt: startOfDay(new Date()) },
    };
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }
    const result = await this.invoiceModel
      .updateMany(filter, { $set: { status: InvoiceStatus.Overdue } })
      .exec();
    if (result.modifiedCount > 0) {
      this.logger.log(`Marked ${result.modifiedCount} invoice(s) overdue`);
    }
    return result.modifiedCount;
  }

  private buildFilter(userId: string, query: QueryInvoicesDto): FilterQuery<InvoiceDocument> {
    const filter: FilterQuery<InvoiceDocument> = { userId: new Types.ObjectId(userId) };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.vendor) {
      filter.vendorName = new RegExp(`^${escapeRegex(query.vendor)}$`, 'i');
    }
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ vendorName: pattern }, { invoiceNumber: pattern }];
    }
    if (query.dateFrom || query.dateTo) {
      filter.dueDate = {};
      if (query.dateFrom) {
        filter.dueDate.$gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        filter.dueDate.$lte = new Date(query.dateTo);
      }
    }
    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      filter.amount = {};
      if (query.minAmount !== undefined) {
        filter.amount.$gte = query.minAmount;
      }
      if (query.maxAmount !== undefined) {
        filter.amount.$lte = query.maxAmount;
      }
    }

    return filter;
  }
}
