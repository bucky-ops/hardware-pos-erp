'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Download, Receipt, Ban, Eye } from 'lucide-react';
import { useSettingsStore } from '@/lib/store';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface SaleItem {
  id: string; productName: string; quantity: number; unitPrice: number; discount: number; total: number; costPrice: number;
  product?: { name: string; sku: string } | null;
}

interface Sale {
  id: string; invoiceNo: string; status: string; subtotal: number; discountAmount: number;
  taxAmount: number; totalAmount: number; amountPaid: number; changeAmount: number;
  paymentMethod: string; notes?: string; isWalkIn: boolean; voidedAt?: string; voidReason?: string;
  createdAt: string;
  customer?: { id: string; name: string } | null;
  items?: SaleItem[];
  payments?: Array<{ id: string; amount: number; method: string; status: string }>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'voided') return <Badge variant="destructive">Voided</Badge>;
  if (status === 'completed') return <Badge className="bg-emerald-600 text-white border-emerald-600">Completed</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

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

export function SaleList() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const currency = useSettingsStore((s) => s.currencySymbol);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('startDate', dateFrom);
    if (dateTo) params.set('endDate', dateTo);
    try {
      const res = await fetch(`/api/sales?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSales(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch { toast.error('Failed to fetch sales'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const viewDetail = async (sale: Sale) => {
    try {
      const res = await fetch(`/api/sales/${sale.id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSelectedSale(json.data || sale);
      setDetailOpen(true);
    } catch { toast.error('Failed to load sale detail'); }
  };

  const handleVoid = async () => {
    if (!selectedSale || !voidReason.trim()) { toast.error('Void reason is required'); return; }
    setVoiding(true);
    try {
      const res = await fetch(`/api/sales/${selectedSale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void', voidReason }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Sale voided');
      setVoidOpen(false); setDetailOpen(false); setVoidReason('');
      fetchSales();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to void sale'); }
    finally { setVoiding(false); }
  };

  const exportCSV = () => {
    const header = 'Invoice,Customer,Status,Payment,Total,Date\n';
    const rows = sales.map((s) =>
      `${s.invoiceNo},"${s.customer?.name || 'Walk-in'}",${s.status},${s.paymentMethod},${s.totalAmount},${new Date(s.createdAt).toISOString()}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sales.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Sales</h2>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoice or customer..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-full sm:w-40" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-full sm:w-40" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Receipt className="h-10 w-10 mb-2" /><p className="text-sm">No sales found</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow></TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.invoiceNo}</TableCell>
                      <TableCell className="font-medium">{s.customer?.name || 'Walk-in'}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Badge variant="secondary" className="capitalize text-xs">{s.paymentMethod.replace('_', ' ')}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{currency}{fmt(s.totalAmount)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewDetail(s)}>
                          <Eye className="h-4 w-4" />
                        </Button>
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

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice {selectedSale?.invoiceNo}</DialogTitle>
            <DialogDescription>{new Date(selectedSale?.createdAt || '').toLocaleString()}</DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={selectedSale.status} />
                <Badge variant="secondary" className="capitalize">{selectedSale.paymentMethod.replace('_', ' ')}</Badge>
                {selectedSale.customer && <span className="text-sm">Customer: <strong>{selectedSale.customer.name}</strong></span>}
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {selectedSale.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{item.productName}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{currency}{fmt(item.unitPrice)}</TableCell>
                      <TableCell className="text-right">{currency}{fmt(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right space-y-1 text-sm">
                <p>Subtotal: <strong>{currency}{fmt(selectedSale.subtotal)}</strong></p>
                {selectedSale.discountAmount > 0 && <p className="text-red-500">Discount: -{currency}{fmt(selectedSale.discountAmount)}</p>}
                {selectedSale.taxAmount > 0 && <p>Tax: {currency}{fmt(selectedSale.taxAmount)}</p>}
                <p className="text-base">Total: <strong className="text-emerald-600 dark:text-emerald-400">{currency}{fmt(selectedSale.totalAmount)}</strong></p>
                <p>Paid: {currency}{fmt(selectedSale.amountPaid)}</p>
                {selectedSale.changeAmount > 0 && <p className="text-muted-foreground">Change: {currency}{fmt(selectedSale.changeAmount)}</p>}
              </div>
              {selectedSale.voidedAt && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 p-3 text-sm">
                  <p className="font-medium text-red-600">Voided</p>
                  <p className="text-muted-foreground">Reason: {selectedSale.voidReason}</p>
                  <p className="text-muted-foreground text-xs">{new Date(selectedSale.voidedAt).toLocaleString()}</p>
                </div>
              )}
              {selectedSale.status === 'completed' && (
                <div className="flex justify-end">
                  <Button variant="destructive" size="sm" onClick={() => setVoidOpen(true)}>
                    <Ban className="h-4 w-4 mr-1" />Void Sale
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Confirmation */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void Sale</DialogTitle>
            <DialogDescription>This will reverse stock and loyalty points. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Void Reason *</label>
            <textarea
              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Enter reason for voiding..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voiding}>{voiding ? 'Voiding...' : 'Confirm Void'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
