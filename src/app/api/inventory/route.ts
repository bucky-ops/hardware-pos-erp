import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { ApiError, ErrorCode, toErrorResponse } from '@/lib/api-errors';

// GET /api/inventory - List adjustments + lowStock type using per-product reorderLevel
export async function GET(request: NextRequest) {
  try {
    // NOTE: Unknown query params (e.g., storeId) are safely ignored.
    // This provides forward-compatibility with multi-store deployments.
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type') || 'adjustments';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    if (type === 'lowStock') {
      // Use raw query to find products where currentStock <= reorderLevel
      const [lowStockProducts, totalCount] = await Promise.all([
        db.$queryRaw<
          Array<{
            id: string;
            name: string;
            sku: string;
            currentStock: number;
            reorderLevel: number;
          }>
        >(Prisma.sql`
          SELECT p.id, p.name, p.sku, p.currentStock, p.reorderLevel
          FROM Product p
          WHERE p.currentStock <= p.reorderLevel
          ORDER BY p.currentStock ASC
          LIMIT ${limit} OFFSET ${skip}
        `),
        db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
          SELECT COUNT(*) as count FROM Product WHERE currentStock <= reorderLevel
        `),
      ]);

      const total = totalCount[0]?.count || 0;

      // Fetch full product data for the low stock items
      const productIds = lowStockProducts.map((p) => p.id);
      const products = productIds.length > 0
        ? await db.product.findMany({
            where: { id: { in: productIds } },
            include: { category: true },
          })
        : [];

      // Sort by currentStock ascending
      products.sort((a, b) => a.currentStock - b.currentStock);

      return NextResponse.json({
        data: products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // Default: list stock adjustments
    const [adjustments, total] = await Promise.all([
      db.stockAdjustment.findMany({
        include: {
          product: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.stockAdjustment.count(),
    ]);

    return NextResponse.json({
      data: adjustments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// POST /api/inventory - Create a stock adjustment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, type, quantity, reason, reference } = body;

    if (!productId || !type || quantity === undefined) {
      throw new ApiError('productId, type, and quantity are required', ErrorCode.VALIDATION_ERROR);
    }

    if (!['addition', 'deduction', 'set'].includes(type)) {
      throw new ApiError('Type must be one of: addition, deduction, set', ErrorCode.VALIDATION_ERROR);
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new ApiError('Product not found', ErrorCode.NOT_FOUND);
    }

    const previousQty = product.currentStock;
    let newQty: number;

    if (type === 'addition') {
      newQty = previousQty + quantity;
    } else if (type === 'deduction') {
      newQty = previousQty - quantity;
    } else {
      // set
      newQty = quantity;
    }

    // Create adjustment and update stock in a transaction
    const adjustment = await db.$transaction(async (tx) => {
      const adj = await tx.stockAdjustment.create({
        data: {
          productId,
          type,
          quantity,
          previousQty,
          newQty,
          reason: reason || null,
          reference: reference || null,
        },
        include: { product: true },
      });

      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newQty },
      });

      return adj;
    });

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
