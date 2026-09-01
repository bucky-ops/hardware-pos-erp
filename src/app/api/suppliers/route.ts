import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/suppliers - List suppliers with search and pagination
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
        { contactPerson: { contains: search } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        include: {
          _count: { select: { purchases: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.supplier.count({ where }),
    ]);

    return NextResponse.json({
      data: suppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

// POST /api/suppliers - Create a supplier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, address, contactPerson } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check unique email
    if (email) {
      const existing = await db.supplier.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'A supplier with this email already exists' }, { status: 409 });
      }
    }

    const supplier = await db.supplier.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        contactPerson: contactPerson || null,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}

// PATCH /api/suppliers - Update a supplier
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, email, phone, address, contactPerson, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
    }

    // Check unique email if being updated
    if (email) {
      const existing = await db.supplier.findFirst({
        where: { email, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'A supplier with this email already exists' }, { status: 409 });
      }
    }

    const supplier = await db.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email: email || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(address !== undefined && { address: address || null }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

// DELETE /api/suppliers - Delete a supplier
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
    }

    // Check if supplier has purchases
    const purchaseCount = await db.purchase.count({ where: { supplierId: id } });
    if (purchaseCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete supplier with existing purchases' },
        { status: 409 }
      );
    }

    await db.supplier.delete({ where: { id } });

    return NextResponse.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
