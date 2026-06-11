import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import {
  addDays,
  addMonths,
  daysBetween,
  monthKey,
  startOfDay,
  startOfMonth,
} from '../common/utils/date.util';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';

/** Month-over-month spend comparison. */
export interface SpendSummary {
  thisMonth: number;
  lastMonth: number;
  changePercent: number | null;
}

/** A vendor ranked by total spend. */
export interface VendorSpend {
  vendor: string;
  total: number;
  invoiceCount: number;
}

/** One month's total in the trend chart. */
export interface MonthlyTrendPoint {
  month: string;
  total: number;
}

/** Invoice counts and amounts grouped by status. */
export interface StatusBreakdownEntry {
  status: InvoiceStatus;
  count: number;
  total: number;
}

/** One day of projected outflow. */
export interface CashflowPoint {
  date: string;
  amountDue: number;
  cumulative: number;
}

/** Everything the dashboard needs in one payload. */
export interface DashboardAnalytics {
  spendSummary: SpendSummary;
  outstandingThisWeek: number;
  topVendors: VendorSpend[];
  monthlyTrend: MonthlyTrendPoint[];
  statusBreakdown: StatusBreakdownEntry[];
  cashflow: CashflowPoint[];
  avgProcessingTimeMs: number;
}

/** Spending comparison between two named periods (agent tool). */
export interface PeriodComparison {
  periodA: { from: string; to: string; total: number; invoiceCount: number };
  periodB: { from: string; to: string; total: number; invoiceCount: number };
  difference: number;
  changePercent: number | null;
}

/** Overdue invoice summary row (agent tool). */
export interface OverdueInvoiceSummary {
  id: string;
  vendorName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
}

/**
 * Read-side analytics over the user's invoices. Spend dates use the
 * invoice issue date, falling back to upload date when absent.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
  ) {}

  /**
   * Builds the complete dashboard payload in parallel.
   *
   * @param userId - Owning user id.
   */
  async dashboard(userId: string): Promise<DashboardAnalytics> {
    const [
      spendSummary,
      outstandingThisWeek,
      topVendors,
      monthlyTrend,
      statusBreakdown,
      cashflow,
      avgProcessingTimeMs,
    ] = await Promise.all([
      this.spendSummary(userId),
      this.outstandingThisWeek(userId),
      this.topVendors(userId, 5),
      this.monthlyTrend(userId, 6),
      this.statusBreakdown(userId),
      this.cashflowProjection(userId, 30),
      this.avgProcessingTime(userId),
    ]);
    return {
      spendSummary,
      outstandingThisWeek,
      topVendors,
      monthlyTrend,
      statusBreakdown,
      cashflow,
      avgProcessingTimeMs,
    };
  }

  /**
   * Total spend this calendar month vs last, with percent change.
   */
  async spendSummary(userId: string): Promise<SpendSummary> {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const nextMonthStart = addMonths(now, 1);
    const lastMonthStart = addMonths(now, -1);

    const [thisMonth, lastMonth] = await Promise.all([
      this.totalBetween(userId, thisMonthStart, nextMonthStart),
      this.totalBetween(userId, lastMonthStart, thisMonthStart),
    ]);

    const changePercent =
      lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : thisMonth > 0 ? null : 0;

    return { thisMonth, lastMonth, changePercent };
  }

  /**
   * Sum of unpaid/overdue invoices due within the next 7 days.
   */
  async outstandingThisWeek(userId: string): Promise<number> {
    const today = startOfDay(new Date());
    const result = await this.invoiceModel
      .aggregate<{ _id: null; total: number }>([
        {
          $match: {
            userId: new Types.ObjectId(userId),
            status: { $in: [InvoiceStatus.Unpaid, InvoiceStatus.Overdue] },
            dueDate: { $gte: today, $lte: addDays(today, 7) },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .exec();
    return result[0]?.total ?? 0;
  }

  /**
   * Vendors ranked by total spend.
   *
   * @param userId - Owning user id.
   * @param limit - Maximum vendors to return.
   */
  async topVendors(userId: string, limit: number): Promise<VendorSpend[]> {
    const rows = await this.invoiceModel
      .aggregate<{ _id: string; total: number; invoiceCount: number }>([
        { $match: { userId: new Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$vendorName',
            total: { $sum: '$amount' },
            invoiceCount: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: limit },
      ])
      .exec();
    return rows.map((row) => ({ vendor: row._id, total: row.total, invoiceCount: row.invoiceCount }));
  }

  /**
   * Spend per month over the trailing N months (zero-filled).
   *
   * @param userId - Owning user id.
   * @param months - Window size in months.
   */
  async monthlyTrend(userId: string, months: number): Promise<MonthlyTrendPoint[]> {
    const now = new Date();
    const windowStart = addMonths(now, -(months - 1));

    const rows = await this.invoiceModel
      .aggregate<{ _id: string; total: number }>([
        {
          $match: { userId: new Types.ObjectId(userId) },
        },
        {
          $addFields: { spendDate: { $ifNull: ['$issueDate', '$createdAt'] } },
        },
        { $match: { spendDate: { $gte: windowStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$spendDate' } },
            total: { $sum: '$amount' },
          },
        },
      ])
      .exec();

    const byMonth = new Map(rows.map((row) => [row._id, row.total]));
    const points: MonthlyTrendPoint[] = [];
    for (let i = 0; i < months; i += 1) {
      const key = monthKey(addMonths(now, i - (months - 1)));
      points.push({ month: key, total: byMonth.get(key) ?? 0 });
    }
    return points;
  }

  /**
   * Invoice counts and totals grouped by status.
   */
  async statusBreakdown(userId: string): Promise<StatusBreakdownEntry[]> {
    const rows = await this.invoiceModel
      .aggregate<{ _id: InvoiceStatus; count: number; total: number }>([
        { $match: { userId: new Types.ObjectId(userId) } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ])
      .exec();
    const byStatus = new Map(rows.map((row) => [row._id, row]));
    return Object.values(InvoiceStatus).map((status) => ({
      status,
      count: byStatus.get(status)?.count ?? 0,
      total: byStatus.get(status)?.total ?? 0,
    }));
  }

  /**
   * Daily outflow projection from unpaid/overdue due dates over the next
   * N days, with a cumulative running total.
   *
   * @param userId - Owning user id.
   * @param days - Projection horizon in days.
   */
  async cashflowProjection(userId: string, days: number): Promise<CashflowPoint[]> {
    const today = startOfDay(new Date());
    const horizon = addDays(today, days);

    const invoices = await this.invoiceModel
      .find({
        userId: new Types.ObjectId(userId),
        status: { $in: [InvoiceStatus.Unpaid, InvoiceStatus.Overdue] },
        dueDate: { $gte: today, $lte: horizon },
      })
      .exec();

    const byDay = new Map<string, number>();
    for (const invoice of invoices) {
      if (!invoice.dueDate) continue;
      const key = invoice.dueDate.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + invoice.amount);
    }

    const points: CashflowPoint[] = [];
    let cumulative = 0;
    for (let i = 0; i <= days; i += 1) {
      const date = addDays(today, i).toISOString().slice(0, 10);
      const amountDue = byDay.get(date) ?? 0;
      cumulative += amountDue;
      points.push({ date, amountDue, cumulative });
    }
    return points;
  }

  /**
   * Average AI extraction time across processed invoices, in ms.
   */
  async avgProcessingTime(userId: string): Promise<number> {
    const result = await this.invoiceModel
      .aggregate<{ _id: null; avg: number }>([
        {
          $match: { userId: new Types.ObjectId(userId), processingTimeMs: { $gt: 0 } },
        },
        { $group: { _id: null, avg: { $avg: '$processingTimeMs' } } },
      ])
      .exec();
    return Math.round(result[0]?.avg ?? 0);
  }

  /**
   * Spend grouped by vendor and month within an optional date range
   * (powers the agent's summarize_spending tool).
   */
  async summarizeSpending(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<{ byVendor: VendorSpend[]; byMonth: MonthlyTrendPoint[]; total: number }> {
    const match: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    const dateStages: PipelineStage[] = [
      { $addFields: { spendDate: { $ifNull: ['$issueDate', '$createdAt'] } } },
    ];
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      dateStages.push({ $match: { spendDate: range } });
    }

    const [byVendorRows, byMonthRows, totalRows] = await Promise.all([
      this.invoiceModel
        .aggregate<{ _id: string; total: number; invoiceCount: number }>([
          { $match: match },
          ...(dateStages as PipelineStage.AddFields[]),
          { $group: { _id: '$vendorName', total: { $sum: '$amount' }, invoiceCount: { $sum: 1 } } },
          { $sort: { total: -1 } },
          { $limit: 25 },
        ])
        .exec(),
      this.invoiceModel
        .aggregate<{ _id: string; total: number }>([
          { $match: match },
          ...(dateStages as PipelineStage.AddFields[]),
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$spendDate' } },
              total: { $sum: '$amount' },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),
      this.invoiceModel
        .aggregate<{ _id: null; total: number }>([
          { $match: match },
          ...(dateStages as PipelineStage.AddFields[]),
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .exec(),
    ]);

    return {
      byVendor: byVendorRows.map((r) => ({ vendor: r._id, total: r.total, invoiceCount: r.invoiceCount })),
      byMonth: byMonthRows.map((r) => ({ month: r._id, total: r.total })),
      total: totalRows[0]?.total ?? 0,
    };
  }

  /**
   * Compares total spend between two date ranges (agent tool).
   */
  async comparePeriods(
    userId: string,
    aFrom: Date,
    aTo: Date,
    bFrom: Date,
    bTo: Date,
  ): Promise<PeriodComparison> {
    const [a, b] = await Promise.all([
      this.totalAndCountBetween(userId, aFrom, aTo),
      this.totalAndCountBetween(userId, bFrom, bTo),
    ]);
    return {
      periodA: {
        from: aFrom.toISOString().slice(0, 10),
        to: aTo.toISOString().slice(0, 10),
        total: a.total,
        invoiceCount: a.count,
      },
      periodB: {
        from: bFrom.toISOString().slice(0, 10),
        to: bTo.toISOString().slice(0, 10),
        total: b.total,
        invoiceCount: b.count,
      },
      difference: a.total - b.total,
      changePercent: b.total > 0 ? ((a.total - b.total) / b.total) * 100 : null,
    };
  }

  /**
   * Lists overdue invoices with days-overdue (agent tool).
   */
  async overdueList(userId: string): Promise<OverdueInvoiceSummary[]> {
    const today = startOfDay(new Date());
    const invoices = await this.invoiceModel
      .find({ userId: new Types.ObjectId(userId), status: InvoiceStatus.Overdue })
      .sort({ dueDate: 1 })
      .limit(100)
      .exec();

    return invoices.map((invoice) => ({
      id: invoice._id.toString(),
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : '',
      daysOverdue: invoice.dueDate ? daysBetween(invoice.dueDate, today) : 0,
    }));
  }

  private async totalBetween(userId: string, from: Date, to: Date): Promise<number> {
    const { total } = await this.totalAndCountBetween(userId, from, to);
    return total;
  }

  private async totalAndCountBetween(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<{ total: number; count: number }> {
    const rows = await this.invoiceModel
      .aggregate<{ _id: null; total: number; count: number }>([
        { $match: { userId: new Types.ObjectId(userId) } },
        { $addFields: { spendDate: { $ifNull: ['$issueDate', '$createdAt'] } } },
        { $match: { spendDate: { $gte: from, $lt: to } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ])
      .exec();
    return { total: rows[0]?.total ?? 0, count: rows[0]?.count ?? 0 };
  }
}
