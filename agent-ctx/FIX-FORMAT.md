# Task FIX-FORMAT: Fix API Response Format Handling

## Summary
Audited all 11 view components and their corresponding API routes. Found and fixed 3 actual issues:

## Issues Found & Fixed

### 1. `/api/dashboard` — BigInt serialization error (CRITICAL)
- **Root cause**: `todaySalesResult._count` from Prisma aggregate returns BigInt in SQLite, which `JSON.stringify` cannot serialize
- **Fix**: Wrapped with `Number()`: `count: Number(todaySalesResult._count || 0)`
- **File**: `src/app/api/dashboard/route.ts` line 50

### 2. `/api/reports` — BigInt serialization error + problematic raw SQL (CRITICAL)
- **Root cause 1**: Same BigInt issue — `summary._count` and `paymentData._count` from Prisma groupBy/aggregate return BigInt
- **Root cause 2**: Original raw SQL used correlated subqueries for cost calculation per day, which was fragile
- **Fix**: Complete rewrite of the API route:
  - Replaced single complex raw SQL with two simpler queries (daily sales + daily cost via JOIN)
  - Merged results in JavaScript instead of SQL correlated subqueries
  - Wrapped ALL aggregate values with `Number()` to prevent BigInt serialization
  - Converted `paymentData` items' `_count` and `_sum.amount` to Number
- **File**: `src/app/api/reports/route.ts` (full rewrite)

### 3. `src/components/dashboard/dashboard.tsx` — Unused import (LINT)
- **Root cause**: `Tooltip` imported from `recharts` but `ChartTooltip` from shadcn/ui is used instead
- **Fix**: Removed unused `Tooltip` from recharts import
- **File**: `src/components/dashboard/dashboard.tsx` line 15

## Components Verified (No Changes Needed)
All other components already correctly handle the API response format:

| Component | API | Format Handling |
|-----------|-----|----------------|
| product-list.tsx | /api/products | `json.data \\|\\| []` ✅ |
| customer-list.tsx | /api/customers | `json.data \\|\\| []` ✅ |
| supplier-list.tsx | /api/suppliers | `json.data \\|\\| []` ✅ |
| sale-list.tsx | /api/sales | `json.data \\|\\| []` ✅ |
| purchase-list.tsx | /api/purchases | `json.data \\|\\| []` ✅ |
| inventory-view.tsx | /api/inventory | `json.data \\|\\| []` ✅ |
| expense-list.tsx | /api/expenses | `json.data \\|\\| []` ✅ |
| error-log-view.tsx | /api/errors | `json.errors \\|\\| []` ✅ |
| settings.tsx | /api/settings | `json.data \\|\\| json` ✅ |
| dashboard.tsx | /api/dashboard | Direct object ✅ |
| reports.tsx | /api/reports | `json.summary`, `json.dailyData`, `json.paymentData` ✅ |

## Verification
- `bun run lint` passes with no errors
