import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toErrorResponse } from '@/lib/api-errors';

// GET /api/dashboard - Aggregate stats using Promise.all for parallel queries
// NOTE: Unknown query params (e.g., storeId) are safely ignored.
// This provides forward-compatibility with multi-store deployments.
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalRevenueResult,
      todaySalesResult,
      totalProducts,
      lowStockCount,
      recentSales,
      topProducts,
      todayExpensesResult,
      totalCustomers,
      totalPurchasesResult,
    ] = await Promise.all([
      db.sale.aggregate({ where: { status: 'completed' }, _sum: { totalAmount: true } }),
      db.sale.aggregate({ where: { status: 'completed', createdAt: { gte: today } }, _sum: { totalAmount: true }, _count: true }),
      db.product.count({ where: { isActive: true } }),
      db.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*) as count FROM Product WHERE currentStock <= reorderLevel`,
      db.sale.findMany({ where: { status: 'completed' }, include: { customer: true, items: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      db.saleItem.groupBy({ by: ['productId'], _sum: { quantity: true, total: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
      db.expense.aggregate({ where: { date: { gte: today } }, _sum: { amount: true } }),
      db.customer.count({ where: { isActive: true } }),
      db.purchase.aggregate({ where: { status: 'received' }, _sum: { totalAmount: true } }),
    ]);

    // Enrich top products with details
    const topProductIds = topProducts.map((p) => p.productId);
    const productDetails = topProductIds.length > 0
      ? await db.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true, sku: true } })
      : [];
    const productMap = new Map(productDetails.map((p) => [p.id, p]));

    const enrichedTopProducts = topProducts.map((tp) => ({
      productId: tp.productId,
      _sum: {
        quantity: Number(tp._sum.quantity || 0),
        total: Number(tp._sum.total || 0),
      },
      product: productMap.get(tp.productId),
    }));

    return NextResponse.json({
      totalRevenue: Number(totalRevenueResult._sum.totalAmount || 0),
      todaySales: {
        total: Number(todaySalesResult._sum.totalAmount || 0),
        count: Number(todaySalesResult._count || 0),
      },
      todayExpenses: Number(todayExpensesResult._sum.amount || 0),
      totalProducts,
      lowStockCount: Number(lowStockCount[0]?.count || 0),
      totalCustomers,
      totalPurchases: Number(totalPurchasesResult._sum.totalAmount || 0),
      recentSales: recentSales.map((s) => ({
        ...s,
        subtotal: Number(s.subtotal),
        totalAmount: Number(s.totalAmount),
        amountPaid: Number(s.amountPaid),
        changeAmount: Number(s.changeAmount),
        discountAmount: Number(s.discountAmount),
        taxAmount: Number(s.taxAmount),
      })),
      topProducts: enrichedTopProducts,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
