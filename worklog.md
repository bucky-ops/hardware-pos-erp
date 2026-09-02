# Work Log

## Task 4 - API Route Files for Hardware POS/ERP System
**Date**: 2025-07-14
**Status**: Completed

### Summary
Created 14 API route files implementing the complete backend API for the Hardware POS/ERP system. All routes follow Next.js 16 App Router conventions using NextRequest/NextResponse.

### Files Created

| # | Route | Methods | Description |
|---|-------|---------|-------------|
| 1 | `/api/products` | GET, POST | Product listing with search/category/isActive/lowStock/ids filters + creation |
| 2 | `/api/categories` | GET, POST | Category listing with counts + creation |
| 3 | `/api/customers` | GET, POST, PATCH, DELETE | Full CRUD with search/pagination |
| 4 | `/api/suppliers` | GET, POST, PATCH, DELETE | Full CRUD with search/pagination |
| 5 | `/api/sales` | GET, POST | Sales listing with filters + creation with transactional validation |
| 6 | `/api/sales/[id]` | GET, PATCH | Single sale view + void sale (transactional stock/loyalty reversal) |
| 7 | `/api/purchases` | GET, POST | Purchase listing + creation with PO number generation |
| 8 | `/api/purchases/[id]` | PATCH | Receive purchase (adds stock in transaction) + status updates |
| 9 | `/api/inventory` | GET, POST | Stock adjustments list + low stock view (per-product reorderLevel) + create adjustment |
| 10 | `/api/expenses` | GET, POST, DELETE | Expense tracking with category/date filters |
| 11 | `/api/dashboard` | GET | Aggregate stats via parallel Promise.all queries |
| 12 | `/api/reports` | GET | Sales summary with daily/payment breakdown + profit analysis |
| 13 | `/api/settings` | GET, PATCH | Store settings get-or-create-default + update |
| 14 | `/api/seed` | POST | Demo data seeding (protected in production with 403) |

### Key Design Decisions
- **Low stock filtering** uses per-product `reorderLevel` via raw SQL, not hardcoded threshold
- **Sales validation**: pre-transaction product check, 422 with `invalidItems` array
- **Invoice numbers** generated inside transaction
- **Payment methods** validated against: cash, card, mobile_money, bank_transfer, credit
- **Dashboard** runs all aggregates in parallel via `Promise.all`
- **Pagination** bounds: `page = Math.max(1, ...)`, `limit = Math.min(Math.max(..., 1), 100)`

---

## Task 5 - Full POS/ERP Rebuild with Collapsible Sidebar & Auto Error Reporting
**Date**: 2025-07-14
**Status**: Completed
**GitHub**: https://github.com/bucky-ops/hardware-pos-erp

### What Was Done

The codebase was completely rebuilt from scratch (previous session's code was lost). The rebuild includes:

1. **Prisma Schema** — 14 models: Category, Product, SerialNumber, Customer, Supplier, Sale, SaleItem, Payment, Purchase, PurchaseItem, StockAdjustment, Expense, StoreSettings, ErrorLog

2. **Collapsible Sidebar Navigation**
   - Desktop: Full-width sidebar (260px) with 12 nav items, collapsible to icon-only mode (68px) via toggle button
   - Collapsed state shows tooltips on hover
   - Mobile: Sheet-based sidebar overlay triggered by hamburger menu
   - Smooth 300ms CSS transition
   - Store name header with logo

3. **Auto Error Reporting System**
   - Client-side: `src/lib/error-reporter.ts` captures unhandled promise rejections, uncaught errors, and 500+ API responses
   - Server-side: `POST /api/errors` logs to ErrorLog model with level, message, stack, component, action, URL, user agent
   - `GET /api/errors` with level filter, pagination, unresolved count badge
   - `PATCH /api/errors` to mark errors as resolved
   - `DELETE /api/errors` to clear resolved errors
   - `ErrorLogView` component shows all captured errors in a table with management controls
   - Global fetch interceptor reports 500+ API errors automatically

4. **12 View Components**: POS Terminal, Dashboard, Products, Customers, Suppliers, Sales, Purchases, Inventory, Expenses, Reports, Error Log, Settings

5. **14 API Routes** with proper validation, transactions, pagination bounds

6. **Demo Data**: 6 categories, 10 products, 3 suppliers, 3 customers, 5 sales, 3 expenses, 1 purchase

### Bugs Fixed During QA
- BigInt serialization in dashboard API (`_count` → `Number()`)  
- Reports API raw SQL rewrite (correlated subqueries → JOIN-based)
- POS terminal data parsing (API returns `{data:[...]}` not `{products:[...]}`)
- Dashboard topProducts format mismatch (`quantitySold` → `_sum.quantity`)

### Verification
- ESLint: 0 errors
- Agent-browser QA: POS, Dashboard, Products, Error Log all verified working
- Sidebar collapse/expand tested successfully
- Error reporting captured 3 errors during development (visible in Error Log view)

### Unresolved / Next Phase
- SQLite → PostgreSQL migration needed for Vercel deployment
- No authentication/authorization configured
- No Zod input validation on API routes
- No unit tests
- Reports chart data needs enrichment
- Some views need mobile responsive polish

---

## Task 2 - MbumahErrorHandler: Centralized Structured Error Handling System
**Date**: 2025-07-14
**Status**: Completed

### Summary
Created a centralized, structured error handling system spanning server-side classification and client-side parsing/toasting. Three files were created/modified to provide consistent error shapes across all API routes.

### Files Created/Modified

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `src/lib/api-errors.ts` | Created | Server-side `ApiError` class, `ErrorCode` enum (15 codes), `classifyError()` (Prisma P2002→CONFLICT, P2025→NOT_FOUND, TypeError→VALIDATION), `toErrorResponse()` (structured JSON + dev stack traces) |
| 2 | `src/lib/mbumah-error-handler.ts` | Created | Client-side `MbumahErrorHandler` class with singleton export. `handleApiError()` parses Response→`StructuredApiError`, `getUserMessage()` maps codes to user-friendly text, `showToast()` dispatches sonner toasts by severity (5xx=error, 4xx=warning, other=info) |
| 3 | `src/lib/error-reporter.ts` | Updated | Enhanced to import `MbumahErrorHandler`, added `reportApiError()` helper that parses structured responses and includes `code`/`statusCode` in reports. Added `Response` handling in `withErrorReporting`. Full backward compatibility preserved |

### Key Design Decisions
- **ErrorCode enum** maps 1:1 to HTTP status codes via `ERROR_STATUS_MAP` record, but allows override per-instance
- **Prisma classification** handles P2002 (unique constraint → CONFLICT) and P2025 (not found → NOT_FOUND) specifically; all other Prisma errors → DB_ERROR (503)
- **Stack trace stripping**: `toErrorResponse()` includes stack only when `NODE_ENV !== 'production'`
- **Console logging**: All classified errors are prefixed with `[MbumahErrorHandler]` for easy log filtering
- **Retryable set**: `{500, 502, 503, 504}` exposed as public `retryableStatusCodes` on the handler
- **User messages**: 15 domain-specific messages (e.g. INSUFFICIENT_STOCK→'Not enough stock available', SALE_VOIDED→'This sale has already been voided')
- **ErrorLog integration**: `reportApiError()` persists structured errors with their code and statusCode for the existing error log view

### Verification
- ESLint: 0 errors
- No API routes or components were modified
- Backward compatible: existing `reportError()`, `withErrorReporting()`, and `initGlobalErrorReporting()` signatures unchanged

---

## Task 3-a — Migrate All 15 API Routes to Centralized Error Handler
**Date**: 2025-07-14
**Status**: Completed

### Summary
Updated all 15 API route files (excluding the root `api/route.ts` which has no error handling) to use the centralized `ApiError`, `ErrorCode`, and `toErrorResponse()` from `src/lib/api-errors.ts`. Also fixed Decimal serialization bugs in the sales routes.

### Files Modified (15)

| # | Route File | Changes |
|---|-----------|---------|
| 1 | `errors/route.ts` | Replaced manual 400/500 `NextResponse.json` with `ApiError(VALIDATION_ERROR)` for bad inputs; `toErrorResponse()` in GET/DELETE/PATCH catch blocks. POST catch kept silent (`{ok: true}`) to prevent cascading failures. |
| 2 | `dashboard/route.ts` | Replaced catch block with `toErrorResponse()`. |
| 3 | `products/route.ts` | `throw ApiError(VALIDATION_ERROR)` for missing name/SKU; `throw ApiError(CONFLICT)` for duplicate SKU; catch → `toErrorResponse()`. |
| 4 | `categories/route.ts` | `throw ApiError(VALIDATION_ERROR)` for missing name; catch → `toErrorResponse()`. |
| 5 | `customers/route.ts` | `throw ApiError(VALIDATION_ERROR)` for missing name/ID; `throw ApiError(CONFLICT)` for duplicate email and sales-exists guard; catch → `toErrorResponse()` on all 4 handlers. |
| 6 | `suppliers/route.ts` | Same pattern as customers. `VALIDATION_ERROR` for missing name/ID; `CONFLICT` for duplicate email and purchases-exists guard. |
| 7 | `sales/route.ts` | **Major**: `throw ApiError(VALIDATION_ERROR)` for missing items; `throw ApiError(INVALID_PAYMENT)` with `validMethods` in details; `throw ApiError(NOT_FOUND)` for missing customer; 422 invalid items response now includes structured fields (`message`, `code`, `statusCode`, `invalidItems`, `context`). **Bug fix**: Serialized all Decimal fields in POST response (subtotal, totalAmount, amountPaid, changeAmount, discountAmount, taxAmount, item.unitPrice, item.costPrice, item.total, item.discount, payment.amount) with `Number()`. |
| 8 | `sales/[id]/route.ts` | `throw ApiError(NOT_FOUND)` for missing sale; `throw ApiError(SALE_VOIDED)` for already-voided; `throw ApiError(VALIDATION_ERROR)` for bad action/missing reason. **Bug fix**: Serialized all Decimal fields in both GET and PATCH responses with `Number()`. Used `Number()` on `existingSale.totalAmount` and `amountPaid` in void calculation. |
| 9 | `purchases/route.ts` | `throw ApiError(VALIDATION_ERROR)` for missing items; `throw ApiError(NOT_FOUND)` for missing supplier and product; catch → `toErrorResponse()`. |
| 10 | `purchases/[id]/route.ts` | Replaced `throw new Error()` inside transaction with `throw new ApiError(NOT_FOUND)` and `throw new ApiError(PURCHASE_RECEIVED)`. Removed manual error message checking in catch. General update path uses `throw ApiError(NOT_FOUND)`. |
| 11 | `inventory/route.ts` | `throw ApiError(VALIDATION_ERROR)` for missing fields and invalid type; `throw ApiError(NOT_FOUND)` for missing product; catch → `toErrorResponse()`. |
| 12 | `expenses/route.ts` | `throw ApiError(VALIDATION_ERROR)` for missing category/amount/ID; `throw ApiError(NOT_FOUND)` for missing expense; catch → `toErrorResponse()`. |
| 13 | `reports/route.ts` | Replaced catch with `toErrorResponse()`. Verified all Decimal/BigInt values already wrapped with `Number()`. |
| 14 | `settings/route.ts` | Replaced both catch blocks with `toErrorResponse()`. |
| 15 | `seed/route.ts` | `new ApiError(FORBIDDEN)` for production env check; catch → `toErrorResponse()`. |

### Key Transformation Patterns Applied

**Pattern 1 — Simple catch replacement:**
```typescript
// BEFORE
} catch (error) {
  console.error('Error:', error);
  return NextResponse.json({ error: 'Failed' }, { status: 500 });
}
// AFTER
} catch (error) {
  return toErrorResponse(error);
}
```

**Pattern 2 — Known error → throw ApiError (caught by toErrorResponse):**
```typescript
// BEFORE
if (!product) {
  return NextResponse.json({ error: 'Product not found' }, { status: 404 });
}
// AFTER
if (!product) {
  throw new ApiError('Product not found', ErrorCode.NOT_FOUND);
}
```

**Pattern 3 — Structured response with extra fields (sales 422):**
```typescript
const err = new ApiError('Some items are invalid', ErrorCode.PRODUCTS_INVALID);
return NextResponse.json({
  message: err.message,
  code: err.code,
  statusCode: err.statusCode,
  invalidItems,
  context: err.context,
}, { status: err.statusCode });
```

**Pattern 4 — Transaction-internal error throwing (purchases/[id]):**
```typescript
// BEFORE: throw new Error('Purchase not found') + manual catch message check
// AFTER: throw new ApiError('Purchase not found', ErrorCode.NOT_FOUND) inside tx, toErrorResponse in catch
```

### Bugs Fixed
1. **Decimal serialization in sales POST**: `subtotal`, `totalAmount`, `amountPaid`, `changeAmount`, `discountAmount`, `taxAmount`, and all item/payment Decimal fields now wrapped with `Number()`
2. **Decimal serialization in sales/[id] GET**: Same Decimal fields serialized with `Number()`
3. **Decimal serialization in sales/[id] PATCH (void)**: Decimal fields serialized; `Number()` used on `totalAmount` and `amountPaid` for unpaid amount calculation

### Verification
- ESLint: 0 errors
- `src/lib/api-errors.ts`, `src/lib/mbumah-error-handler.ts`, `src/lib/error-reporter.ts`: NOT modified
- No component files modified
- Root `api/route.ts` left unchanged (no error handling present)

---

## Task 6 — Fix UNKNOWN_ERROR: MbumahErrorHandler Integration, POS Bug Fixes, Version 1.0.0
**Date**: 2025-07-14
**Status**: Completed
**Version**: 1.0.0
**GitHub**: https://github.com/bucky-ops/hardware-pos-erp

### Root Cause Analysis of `[MbumahErrorHandler] UNKNOWN_ERROR`

The deployed system had a centralized error handler (`MbumahErrorHandler`) that wrapped all unhandled errors into `{message, code, statusCode, context, stack}` but:
1. Every unhandled error became `UNKNOWN_ERROR` with a generic message — no classification
2. No structured error codes on the server — all routes returned `{error: string}`
3. Prisma errors (unique constraint, not found) were not distinguished
4. No client-side parsing of structured errors — toasts showed raw `errData.error`

### Additional Bugs Found
1. **POS terminal field mismatch**: Sent `amountTendered` but API expected `amountPaid`
2. **Missing tax amount**: POS calculated tax but didn't send it in the sale payload
3. **Pre-flight validation parsing**: `vData.products` but API returns `{data: [...]}`
4. **Decimal serialization**: Only fixed in dashboard, not in sales responses

### Changes Made

| # | File | Change |
|---|------|--------|
| 1 | `src/lib/api-errors.ts` | Created: 15 error codes, `ApiError` class, `classifyError()` (Prisma-aware), `toErrorResponse()` |
| 2 | `src/lib/mbumah-error-handler.ts` | Created: Client-side `MbumahErrorHandler` with `handleApiError()`, `getUserMessage()`, `showToast()` |
| 3 | `src/lib/error-reporter.ts` | Enhanced: `reportApiError()`, structured error code/statusCode in reports |
| 4 | `src/app/api/*/route.ts` (15 files) | All migrated to `ApiError` + `toErrorResponse()` |
| 5 | `src/components/pos/pos-terminal.tsx` | Fixed: `amountPaid` field, `taxAmount` in payload, data parsing, MbumahErrorHandler for toasts |
| 6 | `src/app/page.tsx` | Updated: fetch interceptor uses `reportApiError()` for structured 500+ errors |
| 7 | `src/components/error-log/error-log-view.tsx` | Enhanced: Added Code column, error row highlighting, action display |
| 8 | `prisma/schema.prisma` | Added `code` and `statusCode` fields to ErrorLog model |
| 9 | `package.json` | Version bumped: `0.2.0` → `1.0.0` |

### Verification (Agent Browser QA)
- POS checkout: Added 2 items → Paid ₵56.00 → Sale INV-000006 created ✅
- Stock deducted: Electrical Wire 98→97, Light Switch 3→2 ✅
- Dashboard: Shows new sale in recent sales list ✅
- Error Log: New Code column visible, 0 new errors ✅
- Reports: Sales Summary, Payment Methods, Profit Analysis tabs loaded ✅
- Sidebar collapse/expand: Working ✅
- Console: 0 errors ✅
- Dev log: All API calls return 200 ✅
- ESLint: 0 errors ✅

---

## Task 2-b — Store Constants, Error Boundaries, and Defensive API Handling
**Date**: 2025-07-14
**Status**: Completed

### Summary
Addressed three deployed-version discrepancies: (1) `STORE_LIST` reference error, (2) API 500 on unknown query params, (3) missing section error boundaries. All fixes are additive — no existing logic was changed.

### Files Created/Modified

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `src/lib/types.ts` | Modified | Added `StoreLocation` interface, `STORE_LIST` constant (single default store), `DEFAULT_STORE_ID = 'default'` after NAV_ITEMS |
| 2 | `src/components/error-boundary.tsx` | Created | Class-based `ErrorBoundaryInternal` with `componentDidCatch` → `reportError()`, styled Card fallback (AlertTriangle icon, error message, "Try Again" button, "Error has been reported" text), functional `SectionErrorBoundary` wrapper with `sectionName` prop |
| 3 | `src/app/page.tsx` | Modified | Imported `SectionErrorBoundary`, wrapped view rendering in `<SectionErrorBoundary sectionName={currentView}>` |
| 4 | `src/app/api/customers/route.ts` | Modified | Added defensive query param comment in GET handler |
| 5 | `src/app/api/products/route.ts` | Modified | Added defensive query param comment in GET handler |
| 6 | `src/app/api/sales/route.ts` | Modified | Added defensive query param comment in GET handler |
| 7 | `src/app/api/purchases/route.ts` | Modified | Added defensive query param comment in GET handler |
| 8 | `src/app/api/suppliers/route.ts` | Modified | Added defensive query param comment in GET handler |
| 9 | `src/app/api/expenses/route.ts` | Modified | Added defensive query param comment in GET handler |
| 10 | `src/app/api/inventory/route.ts` | Modified | Added defensive query param comment in GET handler |
| 11 | `src/app/api/reports/route.ts` | Modified | Added defensive query param comment in GET handler |
| 12 | `src/app/api/dashboard/route.ts` | Modified | Added defensive query param comment (above function, no `request` param) |
| 13 | `src/lib/store.ts` | Modified | Re-exports `STORE_LIST`, `DEFAULT_STORE_ID`, `StoreLocation` from `./types` |

### Key Design Decisions
- **Error Boundary** uses class component (React requirement) with functional `SectionErrorBoundary` wrapper for ergonomic usage
- **Error reporting** integrates with existing `reportError()` from `@/lib/error-reporter` — errors include `[SectionErrorBoundary:{name}]` prefix
- **No API logic changed** — only added comments documenting that unknown params (like `storeId`) are safely ignored by the existing `searchParams.get()` pattern
- **Dashboard route** has no `request` parameter, so the comment was placed above the function signature
- **Store constants** are single-store by default with `StoreLocation` interface ready for multi-store expansion

### Verification
- ESLint: 0 errors
- No API route logic modified
- Error boundary uses shadcn Card, Button, and lucide-react AlertTriangle
- All 8 GET handlers documented with defensive param comment