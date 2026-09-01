'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Plus, MoreHorizontal, Trash2, Download, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useSettingsStore } from '@/lib/store';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Expense {
  id: string; category: string; amount: number; description?: string; date: string; createdAt: string;
}

const PIE_COLORS = [
  'hsl(160, 84%, 39%)', 'hsl(170, 70%, 45%)', 'hsl(140, 70%, 40%)',
  'hsl(30, 80%, 50%)', 'hsl(350, 70%, 50%)', 'hsl(200, 60%, 50%)',
  'hsl(280, 60%, 55%)', 'hsl(60, 70%, 45%)',
];

const chartConfig: ChartConfig = {
  value: { label: 'Amount' },
};

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function ExpenseList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ category: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const currency = useSettingsStore((s) => s.currencySymbol);

  // Summary data
  const [categoryBreakdown, setCategoryBreakdown] = useState<Array<{ name: string; value: number; fill: string }>>([]);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (catFilter) params.set('category', catFilter);
    try {
      const res = await fetch(`/api/expenses?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setExpenses(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch { toast.error('Failed to fetch expenses'); }
    finally { setLoading(false); }
  }, [page, catFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // Fetch all for summary (lightweight)
  useEffect(() => {
    fetch('/api/expenses?limit=1000')
      .then((r) => r.ok ? r.json() : [])
      .then((json) => {
        const all: Expense[] = json.data || [];
        const catMap = new Map<string, number>();
        let total = 0;
        for (const e of all) {
          catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount);
          total += e.amount;
        }
        setCategoryBreakdown(
          Array.from(catMap.entries()).map(([name, value], i) => ({
            name, value: Math.round(value * 100) / 100,
            fill: PIE_COLORS[i % PIE_COLORS.length],
          })).sort((a, b) => b.value - a.value),
        );
      })
      .catch(() => {});
  }, [fetchExpenses]);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const handleCreate = async () => {
    if (!form.category.trim() || !form.amount) { toast.error('Category and amount are required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: form.category, amount: parseFloat(form.amount), description: form.description || undefined, date: form.date || undefined }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Expense created');
      setDialogOpen(false);
      setForm({ category: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
      fetchExpenses();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (e: Expense) => {
    if (!confirm(`Delete this ${e.category} expense of ${currency}${fmt(e.amount)}?`)) return;
    try {
      const res = await fetch(`/api/expenses?id=${e.id}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
      toast.success('Expense deleted');
      fetchExpenses();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete'); }
  };

  const exportCSV = () => {
    const header = 'Category,Amount,Description,Date\n';
    const rows = expenses.map((e) =>
      `"${e.category}",${e.amount},"${e.description || ''}","${new Date(e.date).toISOString().slice(0, 10)}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'expenses.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  // Get unique categories for filter
  const categories = [...new Set(categoryBreakdown.map((c) => c.name))];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Expenses</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" />Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards + Pie Chart */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Expenses</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{currency}{fmt(categoryBreakdown.reduce((s, c) => s + c.value, 0))}</div></CardContent>
        </Card>
        {categoryBreakdown.slice(0, 3).map((cat) => (
          <Card key={cat.name}>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground truncate">{cat.name}</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold" style={{ color: cat.fill }}>{currency}{fmt(cat.value)}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Pie Chart */}
      {categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Category Breakdown</CardTitle></CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-6">
            <ChartContainer config={chartConfig} className="h-48 w-48">
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {categoryBreakdown.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-2">
              {categoryBreakdown.map((cat) => (
                <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.fill }} />
                  <span className="text-muted-foreground">{cat.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          className="h-9 w-full sm:w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Wallet className="h-10 w-10 mb-2" /><p className="text-sm">No expenses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Category</TableHead><TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead><TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow></TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell><Badge variant="secondary">{e.category}</Badge></TableCell>
                      <TableCell className="hidden sm:table-cell text-sm max-w-[200px] truncate">{e.description || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{currency}{fmt(e.amount)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{new Date(e.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDelete(e)} className="text-red-600"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Expense</DialogTitle>
            <DialogDescription>Record a business expense</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Category *</Label>
              <Input list="exp-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Rent, Utilities, Salary" />
              <datalist id="exp-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Saving...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
