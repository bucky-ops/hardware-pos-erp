import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/sales/[id] - Get a single sale
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sale = await db.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
        payments: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json({ data: sale });
  } catch (error) {
    console.error('Error fetching sale:', error);
    return NextResponse.json({ error: 'Failed to fetch sale' }, { status: 500 });
  }
}

// PATCH /api/sales/[id] - Void a sale (inside transaction, reverse stock, reverse loyalty)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, voidReason } = body;

    if (action !== 'void') {
      return NextResponse.json({ error: 'Only void action is supported' }, { status: 400 });
    }

    if (!voidReason) {
      return NextResponse.json({ error: 'Void reason is required' }, { status: 400 });
    }

    // Check sale exists and is not already voided
    const existingSale = await db.sale.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
        payments: true,
      },
    });

    if (!existingSale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    if (existingSale.status === 'voided') {
      return NextResponse.json({ error: 'Sale is already voided' }, { status: 400 });
    }

    // === VOID INSIDE TRANSACTION ===
    const voidedSale = await db.$transaction(async (tx) => {
      // Reverse stock for all items
      for (const item of existingSale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { increment: item.quantity },
          },
        });
      }

      // Reverse loyalty points
      if (existingSale.customerId && existingSale.customer) {
        const settings = await tx.storeSettings.findFirst();
        if (settings?.enableLoyalty) {
          const points = Math.floor(existingSale.totalAmount * (settings.loyaltyRate / 100));
          await tx.customer.update({
            where: { id: existingSale.customerId },
            data: {
              loyaltyPoints: { decrement: points },
            },
          });
        }

        // Reverse credit balance if payment was credit
        if (existingSale.paymentMethod === 'credit') {
          const unpaidAmount = existingSale.totalAmount - existingSale.amountPaid;
          if (unpaidAmount > 0) {
            await tx.customer.update({
              where: { id: existingSale.customerId },
              data: {
                currentBalance: { decrement: unpaidAmount },
              },
            });
          }
        }
      }

      // Update payment statuses
      for (const payment of existingSale.payments) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'refunded' },
        });
      }

      // Mark sale as voided
      const sale = await tx.sale.update({
        where: { id },
        data: {
          status: 'voided',
          voidedAt: new Date(),
          voidReason,
        },
        include: {
          customer: true,
          items: { include: { product: true } },
          payments: true,
        },
      });

      return sale;
    });

    return NextResponse.json({ data: voidedSale });
  } catch (error) {
    console.error('Error voiding sale:', error);
    return NextResponse.json({ error: 'Failed to void sale' }, { status: 500 });
  }
}
