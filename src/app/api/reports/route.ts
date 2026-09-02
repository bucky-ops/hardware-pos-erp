import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { toErrorResponse } from '@/lib/api-errors';

// GET /api/reports - Sales summary with dailyData and paymentData
export async function GET(request: NextRequest) {
  try {
    // NOTE: Unknown query params (e.g., storeId) are safely ignored.
    // This provides forward-compatibility with multi-store deployments.
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const [dailySalesData, dailyCostData, paymentData, summary, totalCostResult] = await Promise.all([
      // Daily sales data
      db.$queryRaw<
        Array<{
          date: string;
          totalSales: number;
          saleCount: number;
        }>
      >(Prisma.sql`
        SELECT
          DATE(s."createdAt") as date,
          SUM(s."totalAmount") as "totalSales",
          COUNT(s.id) as "saleCount"
        FROM Sale s
        WHERE s.status = 'completed' AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY DATE(s."createdAt")
        ORDER BY date ASC
      `),

      // Daily cost data via JOIN (avoid correlated subqueries)
      db.$queryRaw<
        Array<{
          date: string;
          totalCost: number;
        }>
      >(Prisma.sql`
        SELECT
          DATE(s."createdAt") as date,
          SUM(si."costPrice" * si."quantity") as "totalCost"
        FROM SaleItem si
        JOIN Sale s ON s.id = si."saleId"
        WHERE s.status = 'completed' AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY DATE(s."createdAt")
        ORDER BY date ASC
      `),

      // Payment method breakdown
      db.payment.groupBy({
        by: ['method'],
        where: {
          sale: { status: 'completed', createdAt: { gte: start, lte: end } },
          status: 'completed',
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Overall summary
      db.sale.aggregate({
        where: { status: 'completed', createdAt: { gte: start, lte: end } },
        _sum: { totalAmount: true, discountAmount: true, taxAmount: true },
        _count: true,
      }),

      // Total cost for profit calculation
      db.$queryRaw<[{ totalCost: number }]>(Prisma.sql`
        SELECT SUM(si."costPrice" * si."quantity") as "totalCost"
        FROM SaleItem si
        JOIN Sale s ON s.id = si."saleId"
        WHERE s.status = 'completed' AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
      `),
    ]);

    const totalCost = Number(totalCostResult[0]?.totalCost || 0);
    const totalSales = Number(summary._sum.totalAmount || 0);
    const saleCount = Number(summary._count || 0);

    // Merge daily sales and cost data
    const costMap = new Map(dailyCostData.map((d) => [String(d.date), Number(d.totalCost || 0)]));
    const dailyData = dailySalesData.map((d) => ({
      date: String(d.date),
      totalSales: Number(d.totalSales || 0),
      totalCost: costMap.get(String(d.date)) || 0,
      profit: Number(d.totalSales || 0) - (costMap.get(String(d.date)) || 0),
      saleCount: Number(d.saleCount || 0),
    }));

    // Convert payment data BigInt values to Number
    const paymentDataConverted = paymentData.map((p) => ({
      method: p.method,
      _sum: { amount: Number(p._sum.amount || 0) },
      _count: Number(p._count),
    }));

    return NextResponse.json({
      period: {
        startDate: start,
        endDate: end,
      },
      summary: {
        totalSales,
        totalCost,
        grossProfit: totalSales - totalCost,
        totalDiscount: Number(summary._sum.discountAmount || 0),
        totalTax: Number(summary._sum.taxAmount || 0),
        saleCount,
        averageSale: saleCount > 0 ? totalSales / saleCount : 0,
      },
      dailyData,
      paymentData: paymentDataConverted,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
