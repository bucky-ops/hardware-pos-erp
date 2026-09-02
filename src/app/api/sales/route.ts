import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, ErrorCode, toErrorResponse } from '@/lib/api-errors';

const VALID_PAYMENT_METHODS = ['cash', 'card', 'mobile_money', 'bank_transfer', 'credit'];

// GET /api/sales - List sales with search, status, date filter, pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search } },
        { customer: { name: { contains: search } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {} as Record<string, unknown>;
      if (startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = end;
      }
    }

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          customer: true,
          items: {
            include: { product: true },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.sale.count({ where }),
    ]);

    return NextResponse.json({
      data: sales,
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

// POST /api/sales - Create a sale with full transaction, pre-validation, 422 errors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      items,
      discountAmount = 0,
      taxAmount = 0,
      paymentMethod = 'cash',
      amountPaid = 0,
      notes,
      isWalkIn = true,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError('Sale items are required', ErrorCode.VALIDATION_ERROR);
    }

    // Validate payment method
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      throw new ApiError('Invalid payment method', ErrorCode.INVALID_PAYMENT, undefined, {
        validMethods: VALID_PAYMENT_METHODS,
      });
    }

    // Validate customer exists if provided
    if (customerId) {
      const customer = await db.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        throw new ApiError('Customer not found', ErrorCode.NOT_FOUND);
      }
    }

    // === PRE-TRANSACTION VALIDATION ===
    // Fetch all products and validate BEFORE starting the transaction
    const productIds = items.map((item: { productId: string }) => item.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const invalidItems: Array<{
      index: number;
      productId: string;
      reason: string;
      availableStock: number;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const product = productMap.get(item.productId);

      if (!product) {
        invalidItems.push({
          index: i,
          productId: item.productId,
          reason: 'Product not found',
          availableStock: 0,
        });
      } else if (!product.isActive) {
        invalidItems.push({
          index: i,
          productId: item.productId,
          reason: 'Product is not active',
          availableStock: product.currentStock,
        });
      } else if (product.currentStock < item.quantity) {
        invalidItems.push({
          index: i,
          productId: item.productId,
          reason: `Insufficient stock. Available: ${product.currentStock}, Requested: ${item.quantity}`,
          availableStock: product.currentStock,
        });
      }
    }

    if (invalidItems.length > 0) {
      const err = new ApiError('Some items are invalid', ErrorCode.PRODUCTS_INVALID);
      return NextResponse.json(
        {
          message: err.message,
          code: err.code,
          statusCode: err.statusCode,
          invalidItems,
          context: err.context,
        },
        { status: err.statusCode },
      );
    }

    // === START TRANSACTION ===
    const sale = await db.$transaction(async (tx) => {
      // Generate invoice number INSIDE the transaction
      const settings = await tx.storeSettings.findFirst();
      const prefix = settings?.invoicePrefix || 'INV';
      const nextNum = (settings?.nextInvoiceNo || 1);
      const invoiceNo = `${prefix}-${String(nextNum).padStart(6, '0')}`;

      // Increment invoice number
      if (settings) {
        await tx.storeSettings.update({
          where: { id: settings.id },
          data: { nextInvoiceNo: nextNum + 1 },
        });
      } else {
        await tx.storeSettings.create({
          data: { nextInvoiceNo: nextNum + 1 },
        });
      }

      // Calculate totals
      let subtotal = 0;
      const saleItemsData: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        total: number;
        costPrice: number;
      }> = [];

      for (const item of items) {
        const product = productMap.get(item.productId)!;
        const qty = item.quantity;
        const unitPrice = item.unitPrice ?? product.sellingPrice;
        const itemDiscount = item.discount || 0;
        const itemTotal = qty * unitPrice - itemDiscount;

        subtotal += itemTotal;

        saleItemsData.push({
          productId: item.productId,
          productName: product.name,
          quantity: qty,
          unitPrice,
          discount: itemDiscount,
          total: itemTotal,
          costPrice: product.costPrice,
        });
      }

      const totalAmount = subtotal - (parseFloat(discountAmount) || 0) + (parseFloat(taxAmount) || 0);
      const paidAmount = parseFloat(amountPaid) || 0;
      const changeAmount = paidAmount - totalAmount;

      // Create the sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId: customerId || null,
          subtotal,
          discountAmount: parseFloat(discountAmount) || 0,
          taxAmount: parseFloat(taxAmount) || 0,
          totalAmount,
          amountPaid: paidAmount,
          changeAmount: Math.max(0, changeAmount),
          paymentMethod,
          notes: notes || null,
          isWalkIn,
          status: 'completed',
          items: {
            create: saleItemsData,
          },
          payments: {
            create: {
              amount: paidAmount,
              method: paymentMethod,
              status: 'completed',
            },
          },
        },
        include: {
          customer: true,
          items: { include: { product: true } },
          payments: true,
        },
      });

      // Deduct stock using validated quantities (no Math.max(0) fallback)
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // Update customer loyalty points and balance if credit
      if (customerId) {
        const settingsData = settings || { enableLoyalty: true, loyaltyRate: 1 };
        if (settingsData.enableLoyalty) {
          const points = Math.floor(totalAmount * (settingsData.loyaltyRate / 100));
          await tx.customer.update({
            where: { id: customerId },
            data: {
              loyaltyPoints: { increment: points },
            },
          });
        }

        // If credit payment, increase customer balance
        if (paymentMethod === 'credit') {
          const unpaidAmount = totalAmount - paidAmount;
          if (unpaidAmount > 0) {
            await tx.customer.update({
              where: { id: customerId },
              data: {
                currentBalance: { increment: unpaidAmount },
              },
            });
          }
        }
      }

      return newSale;
    });

    // Serialize Decimal fields to number for the response
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

    return NextResponse.json(serializedSale, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
