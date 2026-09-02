'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Plus, ShoppingBag, PackageCheck, Eye } from 'lucide-react';
import { useSettingsStore } from '@/lib/store';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PurchaseItem {
  id: string; productId: string; productName: string; quantity: number; unitCost: number; total: number;
  product?: { name: string; sku: string } | null;
}

interface Purchase {
  id: string; poNumber: string; status: string; subtotal: number; taxAmount: number;
  totalAmount: number; notes?: string; expectedDate?: string; receivedAt?: string;
  createdAt: string;
  supplier?: { id: string; name: string } | null;
  items?: PurchaseItem[];
}

interface Product {
  id: string; name: string; sku: string; currentStock: number;
}

interface Supplier {
  id: string; name: string;
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: 'bg-amber-500 text-white border-amber-500',
    received: 'bg-emerald-600 text-white border-emerald-600',
    cancelled: 'bg-red-500 text-white border-red-500',
  };
  return <Badge className={cls[status] || 'secondary'}>{status}</Badge>;
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

export function PurchaseList() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [receiving, setReceiving] = useState(false);

  // Create PO form
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [formSupplier, setFormSupplier] = useState('');
  const [formTax, setFormTax] = useState('0');
  const [formNotes, setFormNotes] = useState('');
  const [formExpected, setFormExpected] = useState('');
  const [lineItems, setLineItems] = useState<Array<{ productId: string; quantity: number; unitCost: number }>>([{ productId: '', quantity: 1, unitCost: 0 }]);
  const [saving, setSaving] = useState(false);

  const currency = useSettingsStore((s) => s.currencySymbol);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    try {
      const res = await fetch(`/api/purchases?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPurchases(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch { toast.error('Failed to fetch purchases'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const openCreate = () => {
    setFormSupplier(''); setFormTax('0'); setFormNotes(''); setFormExpected('');
    setLineItems([{ productId: '', quantity: 1, unitCost: 0 }]);
    setCreateOpen(true);
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/suppliers?limit=100').then((r) => r.ok ? r.json() : []).then((d) => setSuppliers(d.data || [])),
      fetch('/api/products?limit=100&isActive=true').then((r) => r.ok ? r.json() : []).then((d) => setAllProducts(d.data || [])),
    ]).catch(() => {});
  }, []);

  const addLine = () => setLineItems([...lineItems, { productId: '', quantity: 1, unitCost: 0 }]);
  const removeLine = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateLine = (i: number, key: string, value: string | number) => {
    const updated = [...lineItems];
    (updated[i] as Record<string, string | number>)[key] = value;
    if (key === 'productId') {
      const prod = allProducts.find((p) => p.id === value);
      if (prod) updated[i].unitCost = prod.sellingPrice;
    }
    setLineItems(updated);
  };

  const handleCreate = async () => {
    const validItems = lineItems.filter((l) => l.productId && l.quantity > 0);
    if (validItems.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: formSupplier || undefined,
          items: validItems,
          taxAmount: parseFloat(formTax) || 0,
          notes: formNotes || undefined,
          expectedDate: formExpected || undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Purchase order created');
      setCreateOpen(false); fetchPurchases();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create PO'); }
    finally { setSaving(false); }
  };

  const viewDetail = (p: Purchase) => { setSelected(p); setDetailOpen(true); };

  const handleReceive = async () => {
    if (!selected) return;
    setReceiving(true);
    try {
      const res = await fetch(`/api/purchases/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'receive' }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Purchase received — stock updated');
      setDetailOpen(false); fetchPurchases();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to receive'); }
    finally { setReceiving(false); }
  };

  const lineTotal = lineItems.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Purchases</h2>
        <Button size="sm" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" />New Purchase Order
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search PO or supplier..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mb-2" /><p className="text-sm">No purchases found</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total</TableHead>
                  <TableHead className="hidden md:table-cell">Expected</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow></TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.poNumber}</TableCell>
                      <TableCell className="font-medium">{p.supplier?.name || '—'}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-right font-medium hidden sm:table-cell">{currency}{fmt(p.totalAmount)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                        {p.expectedDate ? new Date(p.expectedDate).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewDetail(p)}>
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
            <DialogTitle>{selected?.poNumber}</DialogTitle>
            <DialogDescription>{selected && `Created ${new Date(selected.createdAt).toLocaleString()}`}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={selected.status} />
                {selected.supplier && <span className="text-sm">Supplier: <strong>{selected.supplier.name}</strong></span>}
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead><TableHead className="text-right">Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {selected.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{item.productName}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{currency}{fmt(item.unitCost)}</TableCell>
                      <TableCell className="text-right">{currency}{fmt(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right space-y-1 text-sm">
                <p>Subtotal: {currency}{fmt(selected.subtotal)}</p>
                {selected.taxAmount > 0 && <p>Tax: {currency}{fmt(selected.taxAmount)}</p>}
                <p className="text-base font-semibold">Total: {currency}{fmt(selected.totalAmount)}</p>
              </div>
              {selected.status === 'pending' && (
                <div className="flex justify-end">
                  <Button onClick={handleReceive} disabled={receiving} className="bg-emerald-600 hover:bg-emerald-700">
                    <PackageCheck className="h-4 w-4 mr-1" />{receiving ? 'Receiving...' : 'Receive PO'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create PO Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>Add items to create a purchase order</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={formSupplier || '_none'} onValueChange={(v) => setFormSupplier(v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None (walk-in)</SelectItem>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Date</Label>
                <Input type="date" value={formExpected} onChange={(e) => setFormExpected(e.target.value)} />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Line Items</Label>
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      {i === 0 ? <Label className="text-xs">Product</Label> : null}
                      <Select value={li.productId || '_none'} onValueChange={(v) => updateLine(i, 'productId', v === '_none' ? '' : v)}>
                        <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent className="max-h-48">
                          {allProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      {i === 0 ? <Label className="text-xs">Qty</Label> : null}
                      <Input type="number" min={1} value={li.quantity} onChange={(e) => updateLine(i, 'quantity', parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="col-span-3">
                      {i === 0 ? <Label className="text-xs">Unit Cost</Label> : null}
                      <Input type="number" step="0.01" value={li.unitCost} onChange={(e) => updateLine(i, 'unitCost', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1 text-right text-sm font-medium">{currency}{fmt(li.quantity * li.unitCost)}</div>
                    <div className="col-span-1">
                      {lineItems.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeLine(i)}>
                          <span className="text-red-500">&times;</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Amount</Label>
                <Input type="number" step="0.01" value={formTax} onChange={(e) => setFormTax(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
              </div>
            </div>

            <div className="text-right text-sm">
              <span className="text-muted-foreground">Subtotal: {currency}{fmt(lineTotal)}</span>
              {(parseFloat(formTax) || 0) > 0 && <span className="ml-3">Tax: {currency}{fmt(parseFloat(formTax) || 0)}</span>}
              <span className="ml-3 text-base font-bold">Total: {currency}{fmt(lineTotal + (parseFloat(formTax) || 0))}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Creating...' : 'Create PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
