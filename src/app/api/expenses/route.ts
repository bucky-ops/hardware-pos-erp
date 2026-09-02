import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, ErrorCode, toErrorResponse } from '@/lib/api-errors';

// GET /api/expenses - List expenses
export async function GET(request: NextRequest) {
  try {
    // NOTE: Unknown query params (e.g., storeId) are safely ignored.
    // This provides forward-compatibility with multi-store deployments.
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      where.date = {} as Record<string, unknown>;
      if (startDate) {
        (where.date as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.date as Record<string, unknown>).lte = end;
      }
    }

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      db.expense.count({ where }),
    ]);

    return NextResponse.json({
      data: expenses,
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

// POST /api/expenses - Create an expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, amount, description, date } = body;

    if (!category || amount === undefined) {
      throw new ApiError('Category and amount are required', ErrorCode.VALIDATION_ERROR);
    }

    const expense = await db.expense.create({
      data: {
        category,
        amount: parseFloat(amount),
        description: description || null,
        date: date ? new Date(date) : new Date(),
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// DELETE /api/expenses - Delete an expense
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      throw new ApiError('Expense ID is required', ErrorCode.VALIDATION_ERROR);
    }

    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new ApiError('Expense not found', ErrorCode.NOT_FOUND);
    }

    await db.expense.delete({ where: { id } });

    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    return toErrorResponse(error);
  }
}
