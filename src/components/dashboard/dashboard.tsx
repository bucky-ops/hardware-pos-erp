'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DollarSign, ShoppingCart, Package, AlertTriangle, TrendingUp,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useSettingsStore } from '@/lib/store';

type DashboardData = {
  totalRevenue: number;
  todaySales: { total: number; count: number };
  totalProducts: number;
  lowStockCount: number;
  totalCustomers: number;
  recentSales: Array<{
    id: string;
    invoiceNo: string;
    customer?: { name: string } | null;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
  }>;
  topProducts: Array<{
    productId: string;
    product?: { name: string; sku: string } | null;
    _sum: { quantity: number; total: number };
  }>;
  revenueByDay: Array<{ date: string; revenue: number }>;
};

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const chartConfig: ChartConfig = {
  revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
};

function KPICard({ title, value, icon: Icon, sub, color }: {
  title: string; value: string; icon: React.ComponentType<{ className?: string }>;
  sub?: string; color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const currency = useSettingsStore((s) => s.currencySymbol);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Unable to load dashboard data.
      </div>
    );
  }

  // Generate last 7 days chart data from recentSales
  const now = new Date();
  const last7: { date: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last7.push({ date: d.toLocaleDateString('en', { weekday: 'short' }), revenue: 0 });
  }
  // We'll use todaySales as the latest point; for a richer chart we'd need daily data
  // Dashboard API doesn't return daily breakdown, so show recent sales as area points
  const chartData = data.recentSales.slice(0, 7).reverse().map((s) => ({
    date: new Date(s.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    revenue: s.totalAmount,
  }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Revenue" value={`${currency}${fmt(data.totalRevenue)}`} icon={DollarSign} sub="All time" color="bg-emerald-600" />
        <KPICard title="Today's Sales" value={`${currency}${fmt(data.todaySales.total)}`} icon={ShoppingCart} sub={`${data.todaySales.count} transactions`} color="bg-emerald-500" />
        <KPICard title="Products" value={String(data.totalProducts)} icon={Package} sub="Active products" color="bg-teal-600" />
        <KPICard title="Low Stock" value={String(data.lowStockCount)} icon={AlertTriangle} sub="Items need reorder" color="bg-amber-500" />
      </div>

      {/* Revenue Chart + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Recent Sales Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" fill="var(--color-revenue)" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">No sales data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length > 0 ? (
              <div className="space-y-3">
                {data.topProducts.map((tp, i) => (
                  <div key={tp.productId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tp.product?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{tp._sum.quantity} sold</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {currency}{fmt(tp._sum.total)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sales data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentSales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs">{sale.invoiceNo}</TableCell>
                    <TableCell>{sale.customer?.name || 'Walk-in'}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize text-xs">{sale.paymentMethod.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{currency}{fmt(sale.totalAmount)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
