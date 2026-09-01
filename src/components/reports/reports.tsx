'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig,
} from '@/components/ui/chart';
import { useSettingsStore } from '@/lib/store';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface DailyData {
  date: string; totalSales: number; totalCost: number; profit: number; saleCount: number;
}

interface PaymentData {
  method: string; _sum: { amount: number }; _count: number;
}

interface Summary {
  totalSales: number; totalCost: number; grossProfit: number;
  totalDiscount: number; totalTax: number; saleCount: number; averageSale: number;
}

const PIE_COLORS = [
  'hsl(160, 84%, 39%)', 'hsl(170, 70%, 45%)', 'hsl(30, 80%, 50%)',
  'hsl(200, 60%, 50%)', 'hsl(350, 70%, 50%)',
];

const salesChartConfig: ChartConfig = {
  totalSales: { label: 'Revenue', color: 'hsl(160, 84%, 39%)' },
  totalCost: { label: 'Cost', color: 'hsl(0, 70%, 50%)' },
  profit: { label: 'Profit', color: 'hsl(140, 70%, 40%)' },
};

const paymentChartConfig: ChartConfig = {
  value: { label: 'Amount' },
};

export function Reports() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentData[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const currency = useSettingsStore((s) => s.currencySymbol);

  const fetchReports = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    try {
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSummary(json.summary);
      setDailyData(json.dailyData || []);
      setPaymentData(json.paymentData || []);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, [startDate, endDate]);

  const lineData = dailyData.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    totalSales: Math.round(d.totalSales * 100) / 100,
    totalCost: Math.round(d.totalCost * 100) / 100,
    profit: Math.round(d.profit * 100) / 100,
  }));

  const pieData = paymentData.map((p, i) => ({
    name: p.method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: Math.round(p._sum.amount * 100) / 100,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Reports</h2>
        <div className="flex items-center gap-2">
          <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs" /></div>
        </div>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Sales</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold">{currency}{fmt(summary.totalSales)}</div><p className="text-xs text-muted-foreground">{summary.saleCount} transactions</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Cost</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-red-500">{currency}{fmt(summary.totalCost)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Gross Profit</CardTitle></CardHeader>
            <CardContent><div className={`text-xl font-bold ${summary.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{currency}{fmt(summary.grossProfit)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Avg. Sale</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold">{currency}{fmt(summary.averageSale)}</div></CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales Summary</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
          <TabsTrigger value="profit">Profit Analysis</TabsTrigger>
        </TabsList>

        {/* Sales Summary Line Chart */}
        <TabsContent value="sales">
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Daily Revenue</CardTitle></CardHeader>
            <CardContent>
              {lineData.length > 0 ? (
                <ChartContainer config={salesChartConfig} className="h-72 w-full">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="totalSales" stroke="var(--color-totalSales)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex h-72 items-center justify-center text-muted-foreground text-sm">No data for selected period</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods Pie Chart */}
        <TabsContent value="payments">
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Payment Method Breakdown</CardTitle></CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <ChartContainer config={paymentChartConfig} className="h-64 w-64">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                  <div className="grid gap-2">
                    {paymentData.map((p) => (
                      <div key={p.method} className="flex items-center justify-between gap-8 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize text-xs">{p.method.replace('_', ' ')}</Badge>
                          <span className="text-muted-foreground text-xs">({p._count})</span>
                        </div>
                        <span className="font-medium">{currency}{fmt(p._sum.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit Analysis */}
        <TabsContent value="profit">
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Revenue vs Cost vs Profit</CardTitle></CardHeader>
            <CardContent>
              {lineData.length > 0 ? (
                <ChartContainer config={salesChartConfig} className="h-72 w-full">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="totalSales" stroke="var(--color-totalSales)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="totalCost" stroke="var(--color-totalCost)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex h-72 items-center justify-center text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
