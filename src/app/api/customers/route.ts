import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, ErrorCode, toErrorResponse } from '@/lib/api-errors';

// GET /api/customers - List customers with search and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          _count: { select: { sales: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.customer.count({ where }),
    ]);

    return NextResponse.json({
      data: customers,
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

// POST /api/customers - Create a customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, address } = body;

    if (!name) {
      throw new ApiError('Name is required', ErrorCode.VALIDATION_ERROR);
    }

    // Check unique email
    if (email) {
      const existing = await db.customer.findUnique({ where: { email } });
      if (existing) {
        throw new ApiError('A customer with this email already exists', ErrorCode.CONFLICT);
      }
    }

    const customer = await db.customer.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// PATCH /api/customers - Update a customer
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, email, phone, address, isActive } = body;

    if (!id) {
      throw new ApiError('Customer ID is required', ErrorCode.VALIDATION_ERROR);
    }

    // Check unique email if being updated
    if (email) {
      const existing = await db.customer.findFirst({
        where: { email, NOT: { id } },
      });
      if (existing) {
        throw new ApiError('A customer with this email already exists', ErrorCode.CONFLICT);
      }
    }

    const customer = await db.customer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email: email || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(address !== undefined && { address: address || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    return toErrorResponse(error);
  }
}

// DELETE /api/customers - Delete a customer
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      throw new ApiError('Customer ID is required', ErrorCode.VALIDATION_ERROR);
    }

    // Check if customer has sales
    const saleCount = await db.sale.count({ where: { customerId: id } });
    if (saleCount > 0) {
      throw new ApiError('Cannot delete customer with existing sales', ErrorCode.CONFLICT);
    }

    await db.customer.delete({ where: { id } });

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    return toErrorResponse(error);
  }
}
