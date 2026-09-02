import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, ErrorCode, toErrorResponse } from '@/lib/api-errors';

// GET /api/purchases - List purchases
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { poNumber: { contains: search } },
        { supplier: { name: { contains: search } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [purchases, total] = await Promise.all([
      db.purchase.findMany({
        where,
        include: {
          supplier: true,
          items: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.purchase.count({ where }),
    ]);

    return NextResponse.json({
      data: purchases,
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

// POST /api/purchases - Create a purchase
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      supplierId,
      items,
      taxAmount = 0,
      notes,
      expectedDate,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError('Purchase items are required', ErrorCode.VALIDATION_ERROR);
    }

    // Validate supplier exists if provided
    if (supplierId) {
      const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        throw new ApiError('Supplier not found', ErrorCode.NOT_FOUND);
      }
    }

    // Generate PO number
    const count = await db.purchase.count();
    const poNumber = `PO-${String(count + 1).padStart(6, '0')}`;

    // Calculate totals
    let subtotal = 0;
    const purchaseItemsData: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitCost: number;
      total: number;
    }> = [];

    for (const item of items) {
      const product = await db.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        throw new ApiError(`Product not found: ${item.productId}`, ErrorCode.NOT_FOUND);
      }

      const itemTotal = item.quantity * item.unitCost;
      subtotal += itemTotal;

      purchaseItemsData.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
        total: itemTotal,
      });
    }

    const totalAmount = subtotal + (parseFloat(taxAmount) || 0);

    const purchase = await db.purchase.create({
      data: {
        poNumber,
        supplierId: supplierId || null,
        subtotal,
        taxAmount: parseFloat(taxAmount) || 0,
        totalAmount,
        notes: notes || null,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        status: 'pending',
        items: {
          create: purchaseItemsData,
        },
      },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
