/**
 * API contract types mirroring the backend responses.
 */

export type UserRole = 'user' | 'admin';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue';
export type InvoiceSource = 'pdf' | 'image' | 'text' | 'manual';

export interface UserSettings {
  currency: Currency;
  dateFormat: DateFormat;
  notifyDueSoon: boolean;
  notifyOverdue: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  settings: UserSettings;
  createdAt: string;
}

export interface AccountStats {
  totalInvoices: number;
  totalSpend: number;
  chatSessions: number;
  memberSince: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  _id: string;
  vendorName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  subtotal: number;
  taxAmount: number;
  issueDate: string | null;
  dueDate: string | null;
  status: InvoiceStatus;
  paymentDate: string | null;
  lineItems: InvoiceLineItem[];
  notes: string;
  rawText: string;
  source: InvoiceSource;
  processingTimeMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedInvoices {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InvoiceExtraction {
  vendorName: string;
  invoiceNumber: string | null;
  amount: number | null;
  currency: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  issueDate: string | null;
  dueDate: string | null;
  lineItems: InvoiceLineItem[];
  confidence: number;
  ambiguities: string[];
}

export interface ExtractionResponse {
  extraction: InvoiceExtraction;
  source: InvoiceSource;
  rawText: string;
  processingTimeMs: number;
}

export interface FileExtractionOutcome {
  fileName: string;
  success: boolean;
  result?: ExtractionResponse;
  error?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches: Array<{ id: string; vendorName: string; amount: number; createdAt: string }>;
}

export interface SpendSummary {
  thisMonth: number;
  lastMonth: number;
  changePercent: number | null;
}

export interface VendorSpend {
  vendor: string;
  total: number;
  invoiceCount: number;
}

export interface MonthlyTrendPoint {
  month: string;
  total: number;
}

export interface StatusBreakdownEntry {
  status: InvoiceStatus;
  count: number;
  total: number;
}

export interface CashflowPoint {
  date: string;
  amountDue: number;
  cumulative: number;
}

export interface DashboardAnalytics {
  spendSummary: SpendSummary;
  outstandingThisWeek: number;
  topVendors: VendorSpend[];
  monthlyTrend: MonthlyTrendPoint[];
  statusBreakdown: StatusBreakdownEntry[];
  cashflow: CashflowPoint[];
  avgProcessingTimeMs: number;
}

export type NotificationType = 'due_soon' | 'overdue' | 'system';

export interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  invoiceId: string | null;
  read: boolean;
  createdAt: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatSession {
  _id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  confidence: number | null;
  createdAt: string;
}

/** Server-sent events emitted by the chat streaming endpoint. */
export type ChatStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool'; tool: string }
  | { type: 'done'; messageId: string; content: string; confidence: number | null }
  | { type: 'error'; message: string };

/** Query parameters accepted by the invoice list endpoint. */
export interface InvoiceListParams {
  status?: InvoiceStatus;
  vendor?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'vendorName' | 'amount' | 'dueDate' | 'issueDate' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
