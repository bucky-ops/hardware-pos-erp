import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/purchases/[id] - Receive/update purchase (ALL inside transaction)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      action,
      status,
      notes,
      receivedItems,
    } = body;

    if (action === 'receive') {
      // Receive purchase: add stock for all items inside a transaction
      const updatedPurchase = await db.$transaction(async (tx) => {
        const purchase = await tx.purchase.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!purchase) {
          throw new Error('Purchase not found');
        }

        if (purchase.status === 'received') {
          throw new Error('Purchase is already received');
        }

        // Use receivedItems if provided, otherwise receive all items
        const itemsToReceive = receivedItems || purchase.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        }));

        // Update stock for each item
        for (const item of itemsToReceive) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: { increment: item.quantity },
              costPrice: item.unitCost, // Update cost price to latest purchase cost
            },
          });
        }

        // Mark purchase as received
        const updated = await tx.purchase.update({
          where: { id },
          data: {
            status: 'received',
            receivedAt: new Date(),
          },
          include: {
            supplier: true,
            items: { include: { product: true } },
          },
        });

        return updated;
      });

      return NextResponse.json({ data: updatedPurchase });
    }

    // General update (status, notes)
    const existingPurchase = await db.purchase.findUnique({ where: { id } });
    if (!existingPurchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await db.purchase.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update purchase';
    console.error('Error updating purchase:', error);

    if (message === 'Purchase not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'Purchase is already received') {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to update purchase' }, { status: 500 });
  }
}
