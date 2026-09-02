'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePOSCartStore, useSettingsStore } from '@/lib/store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Receipt,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CartItem } from '@/lib/types';
import { errorHandler } from '@/lib/mbumah-error-handler';

/* ------------------------------------------------------------------
   Types
   ------------------------------------------------------------------ */
interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  sellingPrice: number;
  costPrice: number;
  maxDiscount: number;
  reorderLevel?: number;
  categoryId?: string;
  category?: { name: string };
  barcode?: string;
  isActive?: boolean;
}

interface Category {
  id: string;
  name: string;
  _count?: { products: number };
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
}

interface SaleResult {
  sale: {
    id: string;
    invoiceNo: string;
    createdAt: string;
  };
}

interface InvalidItem {
  productId: string;
  productName?: string;
  reason: string;
}

type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'credit';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
  { value: 'bank_transfer', label: 'Transfer', icon: Building2 },
  { value: 'credit', label: 'Credit', icon: Receipt },
];

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */
function formatCurrency(amount: number, symbol: string): string {
  return `${symbol}${amount.toFixed(2)}`;
}

/* ------------------------------------------------------------------
   POSTerminal Component
   ------------------------------------------------------------------ */
export function POSTerminal() {
  /* ---- Store hooks ---- */
  const {
    items,
    customerId,
    discountAmount,
    addItem,
    removeItem,
    updateQuantity,
    updateDiscount,
    setCustomer,
    setDiscountAmount,
    clearCart,
    getSubtotal,
  } = usePOSCartStore();

  const {
    currencySymbol,
    taxRate,
    storeName,
    address,
    phone,
    invoicePrefix,
    receiptFooter,
    loadSettings,
  } = useSettingsStore();

  /* ---- Local state ---- */
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<SaleResult | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  /* ---- Refs ---- */
  const searchRef = useRef<HTMLInputElement>(null);

  /* ---- Load settings ---- */
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /* ---- Fetch products, categories, customers ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, custRes] = await Promise.all([
        fetch('/api/products?isActive=true'),
        fetch('/api/categories'),
        fetch('/api/customers'),
      ]);
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(Array.isArray(data.products) ? data.products : Array.isArray(data.data) ? data.data : []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(Array.isArray(data.categories) ? data.categories : Array.isArray(data.data) ? data.data : []);
      }
      if (custRes.ok) {
        const data = await custRes.json();
        setCustomers(Array.isArray(data.customers) ? data.customers : Array.isArray(data.data) ? data.data : []);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearchQuery('');
        searchRef.current?.blur();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* ---- Computed values ---- */
  const subtotal = getSubtotal();

  const afterDiscount = Math.max(0, subtotal - discountAmount);

  const tax = (afterDiscount * taxRate) / 100;

  const total = afterDiscount + tax;

  const change = paymentMethod === 'cash'
    ? Math.max(0, parseFloat(amountTendered || '0') - total)
    : 0;

  const canPay =
    items.length > 0 &&
    total > 0 &&
    (paymentMethod !== 'cash' || parseFloat(amountTendered || '0') >= total);

  /* ---- Filtered products ---- */
  const filteredProducts = useMemo(() => {
    let result = products;

    if (activeCategoryId !== 'all') {
      result = result.filter((p) => p.categoryId === activeCategoryId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [products, activeCategoryId, searchQuery]);

  /* ---- Customer lookup ---- */
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId],
  );

  /* ---- Add product to cart ---- */
  const handleAddToCart = useCallback(
    (product: Product) => {
      if (product.currentStock <= 0) {
        toast.error(`${product.name} is out of stock`);
        return;
      }

      const existing = items.find((i) => i.productId === product.id);
      if (existing && existing.quantity >= product.currentStock) {
        toast.error(`Maximum stock reached for ${product.name}`);
        return;
      }

      addItem({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.sellingPrice,
        costPrice: product.costPrice,
        discount: 0,
        maxDiscount: product.maxDiscount,
      });
      toast.success(`Added ${product.name}`, { description: '1 unit added to cart' });
    },
    [items, addItem],
  );

  /* ---- Process sale ---- */
  const handleProcessPayment = useCallback(async () => {
    if (items.length === 0 || processing) return;

    setProcessing(true);

    try {
      /* -- Step 1: Pre-flight validation -- */
      const ids = items.map((i) => i.productId).join(',');
      const validateRes = await fetch(`/api/products?ids=${ids}&isActive=true`);

      if (validateRes.ok) {
        const vData = await validateRes.json();
        // API returns { data: [...] } — handle both old and new response shapes
        const validProducts: Product[] = Array.isArray(vData.data)
          ? vData.data
          : Array.isArray(vData.products)
            ? vData.products
            : Array.isArray(vData)
              ? vData
              : [];
        const validIds = new Set(validProducts.map((p: Product) => p.id));

        const invalidItems = items.filter((i) => !validIds.has(i.productId));
        if (invalidItems.length > 0) {
          for (const inv of invalidItems) {
            removeItem(inv.productId);
            toast.error(`Removed: ${inv.productName}`, {
              description: 'Product no longer available or inactive',
            });
          }
          if (items.length - invalidItems.length === 0) {
            setProcessing(false);
            return;
          }
        }

        // Check stock for remaining items
        const validItems = items.filter((i) => validIds.has(i.productId));
        const stockMap = new Map(validProducts.map((p: Product) => [p.id, p.currentStock]));
        const outOfStock = validItems.filter(
          (i) => (stockMap.get(i.productId) ?? 0) < i.quantity,
        );

        if (outOfStock.length > 0) {
          for (const oos of outOfStock) {
            removeItem(oos.productId);
            const currentStock = stockMap.get(oos.productId) ?? 0;
            toast.error(`Removed: ${oos.productName}`, {
              description: currentStock > 0
                ? `Only ${currentStock} in stock (need ${oos.quantity})`
                : 'Out of stock',
            });
          }
          if (validItems.length - outOfStock.length === 0) {
            setProcessing(false);
            return;
          }
        }
      }

      /* -- Step 2: Submit sale -- */
      const salePayload = {
        customerId: customerId || undefined,
        paymentMethod,
        amountPaid: paymentMethod === 'cash' ? parseFloat(amountTendered || '0') : 0,
        discountAmount,
        taxAmount: tax,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          costPrice: i.costPrice,
          discount: i.discount,
        })),
      };

      const saleRes = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload),
      });

      if (!saleRes.ok) {
        const errData = await saleRes.json().catch(() => ({}));

        // Handle structured 422 invalid items response (server-side validation)
        if (saleRes.status === 422 && errData.invalidItems) {
          const invalids: InvalidItem[] = errData.invalidItems;
          for (const inv of invalids) {
            removeItem(inv.productId);
            toast.error(`Removed: ${inv.productName || 'Item'}`, {
              description: inv.reason || 'Validation failed',
            });
          }
        } else {
          // Use MbumahErrorHandler for structured error messages
          const structured = await errorHandler.handleApiError(saleRes);
          errorHandler.showToast(structured);
        }
        setProcessing(false);
        return;
      }

      /* -- Step 3: Success -- */
      const saleResult: SaleResult = await saleRes.json();

      setReceiptData(saleResult);
      setShowReceipt(true);
      clearCart();
      setAmountTendered('');
      setDiscountAmount(0);
      setCustomer(null);
      setPaymentMethod('cash');
      fetchData();
      toast.success('Sale completed successfully!');
    } catch {
      toast.error('Network error', { description: 'Please check your connection' });
    } finally {
      setProcessing(false);
    }
  }, [
    items, processing, customerId, paymentMethod, amountTendered, discountAmount,
    removeItem, clearCart, setDiscountAmount, setCustomer, fetchData,
  ]);

  /* ---- Barcode handler (search triggers add if exact barcode match) ---- */
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match = products.find(
          (p) =>
            (p.barcode && p.barcode.toLowerCase() === q) ||
            p.sku.toLowerCase() === q,
        );
        if (match) {
          handleAddToCart(match);
          setSearchQuery('');
        }
      }
    },
    [searchQuery, products, handleAddToCart],
  );

  /* ================================================================
     RENDER — Left Panel: Product Grid
     ================================================================ */
  const renderProductGrid = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="size-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">No products found</p>
            <p className="text-xs mt-1">Try adjusting your search or category filter</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => handleAddToCart(product)}
              className={cn(
                'relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 active:scale-[0.98] cursor-pointer bg-card',
                product.currentStock <= 0 && 'opacity-50 cursor-not-allowed hover:shadow-none hover:border-border',
              )}
              disabled={product.currentStock <= 0}
            >
              {/* Stock badge */}
              <Badge
                className={cn(
                  'absolute top-2 right-2 text-[10px] px-1.5 py-0',
                  product.currentStock <= 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800'
                    : product.currentStock <= (product.reorderLevel ?? 5)
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
                )}
                variant="outline"
              >
                {product.currentStock <= 0 ? 'Out' : `${product.currentStock}`}
              </Badge>

              <p className="text-sm font-medium leading-tight pr-14 line-clamp-2">
                {product.name}
              </p>
              {product.category && (
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {product.category.name}
                </p>
              )}
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-auto">
                {formatCurrency(product.sellingPrice, currencySymbol)}
              </p>
            </button>
          ))
        )}
      </div>
    );
  };

  /* ================================================================
     RENDER — Right Panel: Cart
     ================================================================ */
  const renderCartPanel = () => {
    return (
      <div className="flex flex-col h-full bg-card border-l">
        {/* Cart header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-semibold text-sm">Cart</h2>
            {items.length > 0 && (
              <Badge className="bg-emerald-600 text-white dark:bg-emerald-500 text-xs">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </Badge>
            )}
          </div>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearCart();
                setDiscountAmount(0);
                setAmountTendered('');
                toast.info('Cart cleared');
              }}
              className="text-muted-foreground hover:text-destructive text-xs h-7"
            >
              <Trash2 className="size-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Customer select */}
        <div className="px-4 pt-3 pb-1">
          <Select
            value={customerId ?? 'walk-in'}
            onValueChange={(v) => setCustomer(v === 'walk-in' ? null : v)}
          >
            <SelectTrigger className="w-full text-xs h-9">
              <SelectValue placeholder="Walk-in Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walk-in">Walk-in Customer</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span>{c.name}</span>
                  {c.phone && (
                    <span className="text-muted-foreground ml-1.5 text-[11px]">
                      {c.phone}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cart items */}
        <ScrollArea className="flex-1 px-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="size-10 mb-3 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Click products to add</p>
            </div>
          ) : (
            <div className="space-y-2 py-3">
              {items.map((item) => {
                const lineTotal =
                  item.unitPrice * item.quantity * (1 - (item.discount || 0) / 100);
                return (
                  <div
                    key={item.productId}
                    className="rounded-lg border bg-background p-3 space-y-2"
                  >
                    {/* Item name + remove */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatCurrency(item.unitPrice, currencySymbol)} each
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.productId)}
                        className="text-muted-foreground hover:text-destructive shrink-0 h-7 w-7 p-0"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {/* Qty controls + discount + subtotal */}
                    <div className="flex items-center gap-2">
                      {/* Quantity */}
                      <div className="flex items-center border rounded-md">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-r-none"
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity - 1)
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center text-xs font-medium tabular-nums">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-l-none"
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1)
                          }
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>

                      {/* Discount % */}
                      <div className="relative flex-1 max-w-[80px]">
                        <Input
                          type="number"
                          min={0}
                          max={item.maxDiscount}
                          value={item.discount || 0}
                          onChange={(e) =>
                            updateDiscount(
                              item.productId,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="h-7 text-xs pr-6 text-right tabular-nums"
                          placeholder="0"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>

                      {/* Line total */}
                      <span className="text-sm font-semibold tabular-nums ml-auto whitespace-nowrap">
                        {formatCurrency(lineTotal, currencySymbol)}
                      </span>
                    </div>

                    {item.maxDiscount > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Max discount: {item.maxDiscount}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Cart footer: totals + payment */}
        {items.length > 0 && (
          <div className="border-t bg-background p-4 space-y-3">
            {/* Discount amount */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap w-20">
                Discount
              </label>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={discountAmount || ''}
                  onChange={(e) =>
                    setDiscountAmount(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="h-8 text-xs pl-7 tabular-nums"
                />
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(subtotal, currencySymbol)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{formatCurrency(discountAmount, currencySymbol)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tax ({taxRate}%)
                </span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(tax, currencySymbol)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(total, currencySymbol)}
                </span>
              </div>
            </div>

            <Separator />

            {/* Payment method */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Payment Method
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {PAYMENT_METHODS.map((pm) => {
                  const Icon = pm.icon;
                  const active = paymentMethod === pm.value;
                  return (
                    <Button
                      key={pm.value}
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMethod(pm.value)}
                      className={cn(
                        'h-auto flex-col gap-1 py-2 px-1 text-[10px] font-medium',
                        active && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="leading-tight text-center">
                        {pm.label}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Amount tendered (cash only) */}
            {paymentMethod === 'cash' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap w-20">
                    Tendered
                  </label>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {currencySymbol}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-xs pl-7 tabular-nums"
                      autoFocus
                    />
                  </div>
                </div>
                {/* Quick tender buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  {[total, ...getQuickTenderAmounts(total)].map((amt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] px-2 tabular-nums"
                      onClick={() => setAmountTendered(amt.toFixed(2))}
                    >
                      {formatCurrency(amt, currencySymbol)}
                    </Button>
                  ))}
                </div>
                {parseFloat(amountTendered || '0') >= total && (
                  <div className="flex justify-between text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <span>Change</span>
                    <span className="tabular-nums">
                      {formatCurrency(change, currencySymbol)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Process payment button */}
            <Button
              className={cn(
                'w-full h-11 text-sm font-semibold transition-all',
                canPay
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
              disabled={!canPay || processing}
              onClick={handleProcessPayment}
            >
              {processing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Banknote className="size-4 mr-2" />
                  Process Payment — {formatCurrency(total, currencySymbol)}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  /* ================================================================
     RENDER — Receipt Dialog
     ================================================================ */
  const renderReceiptDialog = () => {
    if (!receiptData?.sale) return null;
    const sale = receiptData.sale;

    return (
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Receipt</DialogTitle>
          </DialogHeader>

          {/* Receipt content */}
          <div className="bg-white dark:bg-zinc-900 text-black dark:text-zinc-100 rounded-lg border p-6 font-mono text-xs space-y-4">
            {/* Store header */}
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold">{storeName}</h3>
              {address && <p className="text-[10px] text-gray-500 dark:text-zinc-400">{address}</p>}
              {phone && <p className="text-[10px] text-gray-500 dark:text-zinc-400">Tel: {phone}</p>}
            </div>

            <Separator />

            {/* Invoice info */}
            <div className="flex justify-between text-[10px]">
              <span>Invoice: <strong>{sale.invoiceNo}</strong></span>
              <span>{new Date(sale.createdAt).toLocaleString()}</span>
            </div>

            {selectedCustomer && (
              <div className="text-[10px]">
                Customer: <strong>{selectedCustomer.name}</strong>
                {selectedCustomer.phone && ` — ${selectedCustomer.phone}`}
              </div>
            )}

            <Separator />

            {/* Items table */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold border-b pb-1">
                <span className="flex-1">Item</span>
                <span className="w-10 text-center">Qty</span>
                <span className="w-16 text-right">Price</span>
                <span className="w-16 text-right">Total</span>
              </div>

              {/* We use a snapshot of the items that were in the cart at time of sale.
                  Since the cart is cleared after success, we reconstruct from receiptData if available,
                  otherwise we show a placeholder. The API response typically echoes back the items. */}
              {(receiptData as Record<string, unknown>).saleItems
                ? ((receiptData as Record<string, unknown>).saleItems as Array<{
                    productName: string;
                    quantity: number;
                    unitPrice: number;
                    discount: number;
                  }>).map((si, idx) => {
                  const lineTotal = si.unitPrice * si.quantity * (1 - (si.discount || 0) / 100);
                  return (
                    <div key={idx} className="flex justify-between text-[10px] py-0.5">
                      <span className="flex-1 truncate mr-2">{si.productName}</span>
                      <span className="w-10 text-center tabular-nums">{si.quantity}</span>
                      <span className="w-16 text-right tabular-nums">
                        {formatCurrency(si.unitPrice, currencySymbol)}
                      </span>
                      <span className="w-16 text-right tabular-nums">
                        {formatCurrency(lineTotal, currencySymbol)}
                      </span>
                    </div>
                  );
                })
                : /* Fallback if saleItems not in response */
                  <div className="text-center text-[10px] text-muted-foreground py-4">
                    Items data not available in response
                  </div>}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {formatCurrency(subtotal, currencySymbol)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{formatCurrency(discountAmount, currencySymbol)}
                  </span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({taxRate}%)</span>
                  <span className="tabular-nums">
                    {formatCurrency(tax, currencySymbol)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>TOTAL</span>
                <span className="tabular-nums">
                  {formatCurrency(total, currencySymbol)}
                </span>
              </div>
            </div>

            <Separator />

            {/* Payment info */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="capitalize font-medium">{paymentMethod.replace('_', ' ')}</span>
              </div>
              {paymentMethod === 'cash' && parseFloat(amountTendered || '0') > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Tendered</span>
                    <span className="tabular-nums">
                      {formatCurrency(parseFloat(amountTendered || '0'), currencySymbol)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-400">
                    <span>Change</span>
                    <span className="tabular-nums">
                      {formatCurrency(change, currencySymbol)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {receiptFooter && (
              <>
                <Separator />
                <p className="text-center text-[10px] text-gray-500 dark:text-zinc-400 italic">
                  {receiptFooter}
                </p>
              </>
            )}
          </div>

          <DialogFooter className="sm:justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowReceipt(false);
                setReceiptData(null);
              }}
            >
              Close
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                window.print();
              }}
            >
              <Receipt className="size-4 mr-2" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  /* ================================================================
     MAIN RENDER
     ================================================================ */
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ---- Left Panel: Products ---- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Category tabs + Search bar */}
        <div className="border-b bg-card px-4 pt-3 pb-2 space-y-3">
          {/* Category tabs */}
          <ScrollArea className="w-full" orientation="horizontal">
            <div className="flex gap-1.5 pb-1">
              <Button
                variant={activeCategoryId === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategoryId('all')}
                className={cn(
                  'h-7 text-xs shrink-0',
                  activeCategoryId === 'all' &&
                    'bg-emerald-600 hover:bg-emerald-700 text-white',
                )}
              >
                All Products
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategoryId === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={cn(
                    'h-7 text-xs shrink-0',
                    activeCategoryId === cat.id &&
                      'bg-emerald-600 hover:bg-emerald-700 text-white',
                  )}
                >
                  {cat.name}
                  {cat._count?.products != null && (
                    <Badge
                      variant="secondary"
                      className="ml-1.5 h-4 px-1 text-[10px]"
                    >
                      {cat._count.products}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </ScrollArea>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search products or scan barcode (F2)..."
              className="h-9 pl-9 pr-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  searchRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-70">
              <Barcode className="size-3" />
              F2
            </kbd>
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          {renderProductGrid()}
        </div>
      </div>

      {/* ---- Mobile cart toggle ---- */}
      <Button
        className="fixed bottom-4 right-4 z-30 lg:hidden h-12 w-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
        size="icon"
        onClick={() => setCartOpen(!cartOpen)}
      >
        {cartOpen ? (
          <ChevronRight className="size-5" />
        ) : (
          <ShoppingCart className="size-5" />
        )}
        {items.length > 0 && !cartOpen && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-red-500 text-white text-[10px] border-2 border-background">
            {items.reduce((s, i) => s + i.quantity, 0)}
          </Badge>
        )}
      </Button>

      {/* ---- Mobile cart overlay ---- */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setCartOpen(false)}
        />
      )}

      {/* ---- Right Panel: Cart ---- */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-20 w-full max-w-md bg-card shadow-2xl transition-transform duration-300 lg:static lg:translate-x-0 lg:max-w-[420px] lg:w-[420px] lg:shadow-none',
          cartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
        )}
      >
        {/* Mobile close button */}
        <div className="lg:hidden flex items-center justify-end p-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCartOpen(false)}
            className="h-8 w-8 p-0"
          >
            <X className="size-4" />
          </Button>
        </div>

        {renderCartPanel()}
      </div>

      {/* ---- Receipt Dialog ---- */}
      {renderReceiptDialog()}
    </div>
  );
}

/* ------------------------------------------------------------------
   Utility: Quick tender amounts (rounded-up bills)
   ------------------------------------------------------------------ */
function getQuickTenderAmounts(total: number): number[] {
  if (total <= 0) return [];
  const amounts: number[] = [];
  const rounded = Math.ceil(total);
  const denominations = [5, 10, 20, 50, 100, 200, 500];
  for (const d of denominations) {
    const amt = Math.ceil(total / d) * d;
    if (amt > total && !amounts.includes(amt)) {
      amounts.push(amt);
    }
    if (amounts.length >= 3) break;
  }
  // Add the exact total rounded up
  if (!amounts.includes(rounded) && rounded > total) {
    amounts.unshift(rounded);
  }
  return amounts.slice(0, 4);
}
