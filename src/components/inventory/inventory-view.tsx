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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, AlertTriangle, Warehouse } from 'lucide-react';
import { useSettingsStore } from '@/lib/store';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Adjustment {
  id: string; productId: string; type: string; quantity: number;
  previousQty: number; newQty: number; reason?: string; reference?: string;
  createdAt: string;
  product?: { id: string; name: string; sku: string } | null;
}

interface LowStockProduct {
  id: string; name: string; sku: string; currentStock: number; reorderLevel: number;
  costPrice: number; sellingPrice: number;
  category?: { id: string; name: string } | null;
}

interface Product {
  id: string; name: string; sku: string; currentStock: number;
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

export function InventoryView() {
  const [tab, setTab] = useState('adjustments');
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ productId: '', type: 'addition', quantity: 1, reason: '', reference: '' });
  const [saving, setSaving] = useState(false);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?page=${page}&limit=20`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAdjustments(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch { toast.error('Failed to fetch adjustments'); }
    finally { setLoading(false); }
  }, [page]);

  const fetchLowStock = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory?type=lowStock&limit=100');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLowStock(json.data || []);
    } catch { toast.error('Failed to fetch low stock items'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'adjustments') fetchAdjustments();
    else fetchLowStock();
  }, [tab, fetchAdjustments, fetchLowStock]);

  useEffect(() => {
    fetch('/api/products?limit=200&isActive=true')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setProducts(d.data || []))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.productId) { toast.error('Select a product'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: parseInt(String(form.quantity)) || 0 }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Adjustment created');
      setDialogOpen(false);
      setForm({ productId: '', type: 'addition', quantity: 1, reason: '', reference: '' });
      fetchAdjustments();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Inventory</h2>
        {tab === 'adjustments' && (
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" />New Adjustment
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="adjustments">Stock Adjustments</TabsTrigger>
          <TabsTrigger value="lowStock">
            Low Stock Alerts
            {lowStock.length > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">{lowStock.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="adjustments">
          {loading ? (
            <div className="space-y-2 mt-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : adjustments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Warehouse className="h-10 w-10 mb-2" /><p className="text-sm">No adjustments recorded</p>
            </div>
          ) : (
            <Card className="mt-4">
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Product</TableHead><TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Before</TableHead>
                      <TableHead className="text-right">After</TableHead>
                      <TableHead className="hidden sm:table-cell">Reason</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {adjustments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium text-sm">{a.product?.name || a.productId}</TableCell>
                          <TableCell>
                            <Badge variant={a.type === 'addition' ? 'default' : a.type === 'deduction' ? 'destructive' : 'secondary'}
                              className={a.type === 'addition' ? 'bg-emerald-600 text-white border-emerald-600' : ''}>
                              {a.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{a.quantity}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{a.previousQty}</TableCell>
                          <TableCell className="text-right font-medium">{a.newQty}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-xs max-w-[200px] truncate">{a.reason || '—'}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lowStock">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mb-2" /><p className="text-sm">All stock levels are healthy</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {lowStock.map((p) => (
                <Card key={p.id} className={p.currentStock === 0 ? 'border-red-200 dark:border-red-800' : 'border-amber-200 dark:border-amber-800'}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${p.currentStock === 0 ? 'text-red-500' : 'text-amber-500'}`} />
                      {p.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">SKU: {p.sku} {p.category ? `• ${p.category.name}` : ''}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Stock</span>
                      <span className={`text-lg font-bold ${p.currentStock === 0 ? 'text-red-600' : 'text-amber-600 dark:text-amber-400'}`}>{p.currentStock}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Reorder at</span>
                      <span className="text-xs">{p.reorderLevel}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Adjustment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Stock Adjustment</DialogTitle>
            <DialogDescription>Manually adjust product stock</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={form.productId || '_none'} onValueChange={(v) => setForm({ ...form, productId: v === '_none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku}) — Stock: {p.currentStock}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="addition">Addition</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                    <SelectItem value="set">Set Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2"><Label>Reason</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why adjusting stock..." />
            </div>
            <div className="space-y-2"><Label>Reference</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="e.g. PO-000001" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Saving...' : 'Create Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
