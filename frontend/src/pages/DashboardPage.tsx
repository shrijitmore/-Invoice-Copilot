import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarClock, FileText, Timer, Wallet } from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { STATUS_LABELS } from '../lib/constants';
import { formatCurrency, formatDuration, formatMonthKey } from '../lib/format';
import { chartColors, statusColors } from '../theme/colors';
import type { DashboardAnalytics } from '../types/api';

/**
 * Analytics dashboard: KPI cards plus top-vendor, trend, status and
 * cashflow charts built with Recharts.
 */
export function DashboardPage(): JSX.Element {
  const { user } = useAuth();
  const currency = user?.settings.currency ?? 'USD';

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => (await api.get<DashboardAnalytics>('/analytics/dashboard')).data,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  const hasInvoices = (data?.statusBreakdown ?? []).some((entry) => entry.count > 0);

  if (!hasInvoices) {
    return (
      <EmptyState
        icon={FileText}
        title="No invoices yet"
        description="Upload your first invoice and your spending dashboard will come to life with trends, top vendors and cash flow projections."
        action={
          <Link
            to="/invoices/upload"
            className="rounded-lg bg-navy-700 px-5 py-2.5 font-medium text-white transition-colors hover:bg-navy-800"
          >
            Upload an invoice
          </Link>
        }
      />
    );
  }

  const analytics = data as DashboardAnalytics;
  const pieData = analytics.statusBreakdown
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ name: STATUS_LABELS[entry.status], value: entry.count, status: entry.status }));
  const trendData = analytics.monthlyTrend.map((point) => ({
    ...point,
    label: formatMonthKey(point.month),
  }));
  const cashflowData = analytics.cashflow.map((point) => ({
    ...point,
    label: point.date.slice(5),
  }));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Your business spending at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Spend this month"
          value={formatCurrency(analytics.spendSummary.thisMonth, currency)}
          changePercent={analytics.spendSummary.changePercent}
        />
        <StatCard
          icon={CalendarClock}
          label="Due this week"
          value={formatCurrency(analytics.outstandingThisWeek, currency)}
          caption="Unpaid invoices due in the next 7 days"
        />
        <StatCard
          icon={FileText}
          label="Spend last month"
          value={formatCurrency(analytics.spendSummary.lastMonth, currency)}
          caption="Previous calendar month total"
        />
        <StatCard
          icon={Timer}
          label="Avg. processing time"
          value={formatDuration(analytics.avgProcessingTimeMs)}
          caption="AI extraction speed per invoice"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Top 5 vendors by spend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.topVendors} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis type="number" tickFormatter={(value: number) => formatCurrency(value, currency)} fontSize={12} />
              <YAxis type="category" dataKey="vendor" width={110} fontSize={13} />
              <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
              <Bar dataKey="total" fill={chartColors.primary} radius={[0, 6, 6, 0]} name="Total spend" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Monthly spending — last 6 months</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="label" fontSize={13} />
              <YAxis tickFormatter={(value: number) => formatCurrency(value, currency)} fontSize={12} width={90} />
              <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
              <Line
                type="monotone"
                dataKey="total"
                stroke={chartColors.primary}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                name="Spend"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Invoice status</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>
                {pieData.map((entry) => (
                  <Cell key={entry.status} fill={statusColors[entry.status]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Cash flow — next 30 days</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cashflowData} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="label" fontSize={12} interval={6} />
              <YAxis tickFormatter={(value: number) => formatCurrency(value, currency)} fontSize={12} width={90} />
              <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
              <Line
                type="stepAfter"
                dataKey="cumulative"
                stroke={chartColors.secondary}
                strokeWidth={2.5}
                dot={false}
                name="Cumulative due"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
