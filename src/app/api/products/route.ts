import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/products - List products with search, category, isActive, lowStock, ids filters, pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const isActive = searchParams.get('isActive');
    const lowStock = searchParams.get('lowStock');
    const idsParam = searchParams.get('ids');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== null && isActive !== '' && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean).map((id) => id.trim());
      if (ids.length > 0) {
        where.id = { in: ids };
      }
    }

    if (lowStock === 'true') {
      // For lowStock, we need to filter by per-product reorderLevel.
      // SQLite doesn't support column comparisons in WHERE, so we use a raw query approach.
      // Fetch IDs of products where currentStock <= reorderLevel, then intersect with other filters.
      const lowStockProducts = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Product WHERE currentStock <= reorderLevel
      `;
      const lowStockIds = lowStockProducts.map((p) => p.id);
      where.id = idsParam
        ? { in: lowStockIds.filter((id) => {
            const ids = idsParam.split(',').filter(Boolean).map((i) => i.trim());
            return ids.includes(id);
          }) }
        : { in: lowStockIds };
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST /api/products - Create a product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      sku,
      barcode,
      description,
      categoryId,
      unit,
      costPrice,
      sellingPrice,
      wholesalePrice,
      minPrice,
      maxDiscount,
      reorderLevel,
      isSerialized,
      isActive,
    } = body;

    if (!name || !sku) {
      return NextResponse.json({ error: 'Name and SKU are required' }, { status: 400 });
    }

    // Check for unique SKU
    const existingProduct = await db.product.findUnique({ where: { sku } });
    if (existingProduct) {
      return NextResponse.json({ error: 'A product with this SKU already exists' }, { status: 409 });
    }

    const product = await db.product.create({
      data: {
        name,
        sku,
        barcode: barcode || null,
        description: description || null,
        categoryId: categoryId || null,
        unit: unit || 'pcs',
        costPrice: parseFloat(costPrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        wholesalePrice: wholesalePrice != null ? parseFloat(wholesalePrice) : null,
        minPrice: minPrice != null ? parseFloat(minPrice) : null,
        maxDiscount: parseFloat(maxDiscount) || 0,
        reorderLevel: parseInt(reorderLevel) || 10,
        isSerialized: Boolean(isSerialized),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: { category: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
