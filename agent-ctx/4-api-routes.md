# Task 4: API Route Files

## Status: Completed

## Files Created (14 API route files)

1. **`/src/app/api/products/route.ts`** - GET (list with search, category, isActive, lowStock, ids filter, pagination) + POST (create product with SKU uniqueness check)
2. **`/src/app/api/categories/route.ts`** - GET (list with product/children count) + POST (create)
3. **`/src/app/api/customers/route.ts`** - GET (list with search, pagination) + POST (create) + PATCH (update) + DELETE (with sale check)
4. **`/src/app/api/suppliers/route.ts`** - GET (list with search, pagination) + POST (create) + PATCH (update) + DELETE (with purchase check)
5. **`/src/app/api/sales/route.ts`** - GET (list with search, status, date filter, pagination) + POST (create sale with full transaction, pre-validation, 422 invalidItems error)
6. **`/src/app/api/sales/[id]/route.ts`** - GET (single sale with items/payments) + PATCH (void sale inside transaction, reverse stock, reverse loyalty, reverse credit)
7. **`/src/app/api/purchases/route.ts`** - GET (list with search, status filter) + POST (create with PO number generation)
8. **`/src/app/api/purchases/[id]/route.ts`** - PATCH (receive action adds stock + updates cost price inside transaction; general status/notes update)
9. **`/src/app/api/inventory/route.ts`** - GET (list adjustments OR lowStock type using per-product reorderLevel via raw SQL) + POST (create adjustment in transaction)
10. **`/src/app/api/expenses/route.ts`** - GET (list with category/date filter) + POST (create) + DELETE
11. **`/src/app/api/dashboard/route.ts`** - GET (aggregate stats: totalRevenue, todaySales, totalProducts, lowStockCount, recentSales, topProducts — all via Promise.all)
12. **`/src/app/api/reports/route.ts`** - GET (sales summary with dailyData, paymentData, profit calculation via Prisma.sql)
13. **`/src/app/api/settings/route.ts`** - GET (get or create default) + PATCH (update any field)
14. **`/src/app/api/seed/route.ts`** - POST (seed demo data: 6 categories, 10 products, 3 suppliers, 3 customers, 5 sales, 3 expenses, 1 purchase, settings — protected with 403 in production)

## Key Implementation Details

- **Pagination**: All paginated routes use `page = Math.max(1, ...)` and `limit = Math.min(Math.max(..., 1), 100)`
- **Low Stock**: Uses per-product `reorderLevel` field via raw SQL `WHERE currentStock <= reorderLevel`, NOT hardcoded 10
- **Sales POST**: Pre-transaction validation checks product exists, is active, and has sufficient stock. Returns structured 422 with `invalidItems` array
- **Invoice Number**: Generated INSIDE the transaction using StoreSettings.nextInvoiceNo
- **Payment Methods**: Validated against `['cash', 'card', 'mobile_money', 'bank_transfer', 'credit']`
- **Stock Deduction**: Uses validated quantities directly with `decrement`, no `Math.max(0)` fallback
- **Seed Protection**: Returns 403 if `NODE_ENV === 'production'`
- **Dashboard**: All queries run in parallel via `Promise.all`
- **Void Sale**: Full reversal inside transaction — stock restored, loyalty points decremented, credit balance reversed, payments marked as refunded
- **Raw SQL**: Uses `Prisma.sql` tagged template for parameterized queries in reports and inventory routes