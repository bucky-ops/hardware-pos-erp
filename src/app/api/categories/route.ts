import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, ErrorCode, toErrorResponse } from '@/lib/api-errors';

// GET /api/categories - List all categories
export async function GET() {
  try {
    const categories = await db.category.findMany({
      include: {
        _count: { select: { products: true, children: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// POST /api/categories - Create a category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parentId } = body;

    if (!name) {
      throw new ApiError('Name is required', ErrorCode.VALIDATION_ERROR);
    }

    const category = await db.category.create({
      data: {
        name,
        parentId: parentId || null,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
