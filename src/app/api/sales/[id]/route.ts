import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, ErrorCode, toErrorResponse } from '@/lib/api-errors';

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
      throw new ApiError('Sale not found', ErrorCode.NOT_FOUND);
    }

    // Serialize Decimal fields to number
    const serializedSale = {
      ...sale,
      subtotal: Number(sale.subtotal),
      totalAmount: Number(sale.totalAmount),
      amountPaid: Number(sale.amountPaid),
      changeAmount: Number(sale.changeAmount),
      discountAmount: Number(sale.discountAmount),
      taxAmount: Number(sale.taxAmount),
      items: sale.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        costPrice: Number(item.costPrice),
        total: Number(item.total),
        discount: Number(item.discount),
      })),
      payments: sale.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    };

    return NextResponse.json({ data: serializedSale });
  } catch (error) {
    return toErrorResponse(error);
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
      throw new ApiError('Only void action is supported', ErrorCode.VALIDATION_ERROR);
    }

    if (!voidReason) {
      throw new ApiError('Void reason is required', ErrorCode.VALIDATION_ERROR);
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
      throw new ApiError('Sale not found', ErrorCode.NOT_FOUND);
    }

    if (existingSale.status === 'voided') {
      throw new ApiError('Sale is already voided', ErrorCode.SALE_VOIDED);
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
          const points = Math.floor(Number(existingSale.totalAmount) * (settings.loyaltyRate / 100));
          await tx.customer.update({
            where: { id: existingSale.customerId },
            data: {
              loyaltyPoints: { decrement: points },
            },
          });
        }

        // Reverse credit balance if payment was credit
        if (existingSale.paymentMethod === 'credit') {
          const unpaidAmount = Number(existingSale.totalAmount) - Number(existingSale.amountPaid);
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

    // Serialize Decimal fields
    const serializedVoidedSale = {
      ...voidedSale,
      subtotal: Number(voidedSale.subtotal),
      totalAmount: Number(voidedSale.totalAmount),
      amountPaid: Number(voidedSale.amountPaid),
      changeAmount: Number(voidedSale.changeAmount),
      discountAmount: Number(voidedSale.discountAmount),
      taxAmount: Number(voidedSale.taxAmount),
      items: voidedSale.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        costPrice: Number(item.costPrice),
        total: Number(item.total),
        discount: Number(item.discount),
      })),
      payments: voidedSale.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    };

    return NextResponse.json({ data: serializedVoidedSale });
  } catch (error) {
    return toErrorResponse(error);
  }
}
