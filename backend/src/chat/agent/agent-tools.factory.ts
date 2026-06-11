import { Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { ExtractionService } from '../../ai/extraction.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { InvoicesService } from '../../invoices/invoices.service';
import { QueryInvoicesDto } from '../../invoices/dto/query-invoices.dto';
import { InvoiceStatus } from '../../invoices/schemas/invoice.schema';

/** Callback invoked whenever the agent executes a tool. */
export type ToolEventHandler = (toolName: string) => void;

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .describe('Date in YYYY-MM-DD format');

/**
 * Builds the per-request LangChain tool belt. Every tool closes over the
 * authenticated user's id, so the agent can only ever touch that user's
 * data.
 */
@Injectable()
export class AgentToolsFactory {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly analyticsService: AnalyticsService,
    private readonly extractionService: ExtractionService,
  ) {}

  /**
   * Creates the full tool set scoped to one user.
   *
   * @param userId - The authenticated user's id.
   * @param onToolEvent - Notified on each tool execution (drives UI status).
   * @returns Tools ready to bind to the chat model.
   */
  createTools(userId: string, onToolEvent: ToolEventHandler): StructuredToolInterface[] {
    const track = <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      onToolEvent(name);
      return fn();
    };

    const extractInvoice = tool(
      async ({ text }: { text: string }) =>
        track('extract_invoice', async () => {
          const { extraction } = await this.extractionService.extractFromText(text);
          return JSON.stringify(extraction);
        }),
      {
        name: 'extract_invoice',
        description:
          'Extract structured invoice fields (vendor, amount, dates, line items) from raw invoice text the user pasted into the chat.',
        schema: z.object({ text: z.string().max(20_000).describe('Raw invoice text') }),
      },
    );

    const summarizeSpending = tool(
      async ({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) =>
        track('summarize_spending', async () => {
          const summary = await this.analyticsService.summarizeSpending(
            userId,
            dateFrom ? new Date(dateFrom) : undefined,
            dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined,
          );
          return JSON.stringify(summary);
        }),
      {
        name: 'summarize_spending',
        description:
          'Summarize total spending grouped by vendor and by month, optionally within a date range.',
        schema: z.object({
          dateFrom: dateString.optional(),
          dateTo: dateString.optional(),
        }),
      },
    );

    const findOverdue = tool(
      async () =>
        track('find_overdue', async () => {
          await this.invoicesService.refreshOverdueStatuses(userId);
          return JSON.stringify(await this.analyticsService.overdueList(userId));
        }),
      {
        name: 'find_overdue',
        description: 'List all overdue invoices with amounts and days overdue.',
        schema: z.object({}),
      },
    );

    const calculateCashflow = tool(
      async ({ days }: { days?: number }) =>
        track('calculate_cashflow', async () => {
          const projection = await this.analyticsService.cashflowProjection(userId, days ?? 30);
          // Only days with outflow keep the payload small for the model.
          return JSON.stringify(projection.filter((point) => point.amountDue > 0));
        }),
      {
        name: 'calculate_cashflow',
        description:
          'Project upcoming cash outflow based on unpaid invoice due dates over the next N days (default 30).',
        schema: z.object({ days: z.number().int().min(1).max(120).optional() }),
      },
    );

    const getTopVendors = tool(
      async ({ limit }: { limit?: number }) =>
        track('get_top_vendors', async () => {
          return JSON.stringify(await this.analyticsService.topVendors(userId, limit ?? 5));
        }),
      {
        name: 'get_top_vendors',
        description: 'Rank vendors by total spend.',
        schema: z.object({ limit: z.number().int().min(1).max(25).optional() }),
      },
    );

    const comparePeriods = tool(
      async (input: { aFrom: string; aTo: string; bFrom: string; bTo: string }) =>
        track('compare_periods', async () => {
          const comparison = await this.analyticsService.comparePeriods(
            userId,
            new Date(input.aFrom),
            new Date(`${input.aTo}T23:59:59.999Z`),
            new Date(input.bFrom),
            new Date(`${input.bTo}T23:59:59.999Z`),
          );
          return JSON.stringify(comparison);
        }),
      {
        name: 'compare_periods',
        description:
          'Compare total spending between two date ranges (e.g. this month vs last month).',
        schema: z.object({
          aFrom: dateString.describe('Start of the first period'),
          aTo: dateString.describe('End of the first period'),
          bFrom: dateString.describe('Start of the second period'),
          bTo: dateString.describe('End of the second period'),
        }),
      },
    );

    const answerQuestion = tool(
      async (input: {
        search?: string;
        vendor?: string;
        status?: 'paid' | 'unpaid' | 'overdue';
        dateFrom?: string;
        dateTo?: string;
      }) =>
        track('answer_question', async () => {
          const query = new QueryInvoicesDto();
          query.search = input.search;
          query.vendor = input.vendor;
          query.status = input.status as InvoiceStatus | undefined;
          query.dateFrom = input.dateFrom;
          query.dateTo = input.dateTo;
          query.limit = 50;
          const { items, total } = await this.invoicesService.findAll(userId, query);
          return JSON.stringify({
            total,
            invoices: items.map((inv) => ({
              id: inv._id.toString(),
              vendorName: inv.vendorName,
              invoiceNumber: inv.invoiceNumber,
              amount: inv.amount,
              currency: inv.currency,
              issueDate: inv.issueDate?.toISOString().slice(0, 10) ?? null,
              dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? null,
              status: inv.status,
              paymentDate: inv.paymentDate?.toISOString().slice(0, 10) ?? null,
              notes: inv.notes.slice(0, 200),
            })),
          });
        }),
      {
        name: 'answer_question',
        description:
          "Fetch the user's invoices (optionally filtered by text search, vendor, status or due-date range) to ground answers to general questions about their invoice data.",
        schema: z.object({
          search: z.string().max(200).optional().describe('Match vendor name or invoice number'),
          vendor: z.string().max(200).optional().describe('Exact vendor name'),
          status: z.enum(['paid', 'unpaid', 'overdue']).optional(),
          dateFrom: dateString.optional().describe('Earliest due date'),
          dateTo: dateString.optional().describe('Latest due date'),
        }),
      },
    );

    const exportData = tool(
      async () =>
        track('export_data', async () => {
          return JSON.stringify({
            status: 'ready',
            note: 'A CSV download of all invoices has been triggered in the user interface. Confirm this to the user.',
          });
        }),
      {
        name: 'export_data',
        description:
          "Trigger a CSV export download of all the user's invoices. Use when the user asks to export or download their data.",
        schema: z.object({}),
      },
    );

    return [
      extractInvoice,
      summarizeSpending,
      findOverdue,
      calculateCashflow,
      getTopVendors,
      comparePeriods,
      answerQuestion,
      exportData,
    ];
  }
}
