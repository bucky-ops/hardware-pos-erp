import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/seed - Seed demo data (protected in production)
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Seeding is not allowed in production' },
      { status: 403 }
    );
  }

  try {
    // Check if data already exists
    const existingProducts = await db.product.count();
    if (existingProducts > 0) {
      return NextResponse.json(
        { message: 'Database already has data. Skipping seed.' },
        { status: 200 }
      );
    }

    // Create categories
    const categories = await Promise.all([
      db.category.create({ data: { name: 'Tools' } }),
      db.category.create({ data: { name: 'Plumbing' } }),
      db.category.create({ data: { name: 'Electrical' } }),
      db.category.create({ data: { name: 'Building Materials' } }),
      db.category.create({ data: { name: 'Paints & Finishes' } }),
      db.category.create({ data: { name: 'Safety Equipment' } }),
    ]);

    // Create products
    const products = await Promise.all([
      db.product.create({
        data: {
          name: 'Hammer (16oz)',
          sku: 'TL-001',
          categoryId: categories[0].id,
          costPrice: 15,
          sellingPrice: 25,
          wholesalePrice: 20,
          reorderLevel: 15,
          currentStock: 50,
        },
      }),
      db.product.create({
        data: {
          name: 'Screwdriver Set',
          sku: 'TL-002',
          categoryId: categories[0].id,
          costPrice: 20,
          sellingPrice: 35,
          wholesalePrice: 28,
          reorderLevel: 10,
          currentStock: 30,
        },
      }),
      db.product.create({
        data: {
          name: 'PVC Pipe (1 inch)',
          sku: 'PL-001',
          categoryId: categories[1].id,
          costPrice: 5,
          sellingPrice: 8,
          wholesalePrice: 6,
          reorderLevel: 100,
          currentStock: 200,
        },
      }),
      db.product.create({
        data: {
          name: 'Ball Valve (1/2 inch)',
          sku: 'PL-002',
          categoryId: categories[1].id,
          costPrice: 8,
          sellingPrice: 15,
          reorderLevel: 20,
          currentStock: 5, // Low stock!
        },
      }),
      db.product.create({
        data: {
          name: 'Electrical Wire (2.5mm)',
          sku: 'EL-001',
          categoryId: categories[2].id,
          costPrice: 30,
          sellingPrice: 50,
          wholesalePrice: 40,
          reorderLevel: 50,
          currentStock: 100,
        },
      }),
      db.product.create({
        data: {
          name: 'Light Switch (1-Gang)',
          sku: 'EL-002',
          categoryId: categories[2].id,
          costPrice: 3,
          sellingPrice: 6,
          reorderLevel: 30,
          currentStock: 8, // Low stock!
        },
      }),
      db.product.create({
        data: {
          name: 'Cement (50kg bag)',
          sku: 'BM-001',
          categoryId: categories[3].id,
          costPrice: 25,
          sellingPrice: 40,
          wholesalePrice: 32,
          reorderLevel: 20,
          currentStock: 150,
        },
      }),
      db.product.create({
        data: {
          name: 'Emulsion Paint (20L)',
          sku: 'PF-001',
          categoryId: categories[4].id,
          costPrice: 80,
          sellingPrice: 130,
          wholesalePrice: 105,
          reorderLevel: 10,
          currentStock: 3, // Low stock!
        },
      }),
      db.product.create({
        data: {
          name: 'Safety Helmet',
          sku: 'SE-001',
          categoryId: categories[5].id,
          costPrice: 10,
          sellingPrice: 18,
          reorderLevel: 20,
          currentStock: 25,
        },
      }),
      db.product.create({
        data: {
          name: 'Safety Goggles',
          sku: 'SE-002',
          categoryId: categories[5].id,
          costPrice: 5,
          sellingPrice: 10,
          reorderLevel: 15,
          currentStock: 40,
        },
      }),
    ]);

    // Create suppliers
    const suppliers = await Promise.all([
      db.supplier.create({
        data: {
          name: 'Accra Hardware Supply',
          email: 'info@accrahardware.com',
          phone: '+233 24 123 4567',
          address: 'Industrial Area, Accra',
          contactPerson: 'Kwame Asante',
        },
      }),
      db.supplier.create({
        data: {
          name: 'Tema Building Materials Ltd',
          email: 'sales@temabm.com',
          phone: '+233 20 987 6543',
          address: 'Tema Harbour Road, Tema',
          contactPerson: 'Ama Mensah',
        },
      }),
      db.supplier.create({
        data: {
          name: 'Kumasi Electrical Wholesalers',
          email: 'orders@kumaselec.com',
          phone: '+233 50 555 1234',
          address: 'Kejetia Market, Kumasi',
          contactPerson: 'Kofi Boakye',
        },
      }),
    ]);

    // Create customers
    const customers = await Promise.all([
      db.customer.create({
        data: {
          name: 'John Construction Co.',
          email: 'john@construction.com',
          phone: '+233 24 000 1111',
          address: 'East Legon, Accra',
        },
      }),
      db.customer.create({
        data: {
          name: 'Ama Plumbing Services',
          email: 'ama@plumbing.com',
          phone: '+233 20 000 2222',
          address: 'Madina, Accra',
        },
      }),
      db.customer.create({
        data: {
          name: 'Kwame Electrician',
          phone: '+233 50 000 3333',
          address: 'Teshie, Accra',
        },
      }),
    ]);

    // Create some completed sales
    const salesData = [
      {
        customerId: customers[0].id,
        items: [
          { productId: products[0].id, quantity: 5 },
          { productId: products[1].id, quantity: 3 },
        ],
        paymentMethod: 'cash' as const,
        daysAgo: 1,
      },
      {
        customerId: customers[1].id,
        items: [
          { productId: products[2].id, quantity: 20 },
          { productId: products[3].id, quantity: 10 },
        ],
        paymentMethod: 'mobile_money' as const,
        daysAgo: 2,
      },
      {
        customerId: null,
        items: [
          { productId: products[4].id, quantity: 2 },
          { productId: products[5].id, quantity: 5 },
        ],
        paymentMethod: 'cash' as const,
        daysAgo: 3,
      },
      {
        customerId: customers[2].id,
        items: [
          { productId: products[6].id, quantity: 10 },
          { productId: products[8].id, quantity: 4 },
        ],
        paymentMethod: 'card' as const,
        daysAgo: 5,
      },
      {
        customerId: null,
        items: [
          { productId: products[7].id, quantity: 2 },
          { productId: products[9].id, quantity: 6 },
        ],
        paymentMethod: 'cash' as const,
        daysAgo: 7,
      },
    ];

    // Create store settings
    await db.storeSettings.create({
      data: {
        storeName: 'QuickBuild Hardware',
        address: '12 Industrial Road, Accra, Ghana',
        phone: '+233 30 277 8899',
        email: 'info@quickbuildhardware.com',
        taxRate: 12.5,
        currency: 'GHS',
        currencySymbol: '₵',
        invoicePrefix: 'INV',
        nextInvoiceNo: 6,
        enableLoyalty: true,
        loyaltyRate: 1,
        receiptFooter: 'Thank you for shopping with QuickBuild Hardware!',
      },
    });

    // Create sales within transactions
    for (const saleData of salesData) {
      const saleDate = new Date();
      saleDate.setDate(saleDate.getDate() - saleData.daysAgo);

      await db.$transaction(async (tx) => {
        const settings = await tx.storeSettings.findFirst();
        const prefix = settings?.invoicePrefix || 'INV';
        const nextNum = (settings?.nextInvoiceNo || 1);
        const invoiceNo = `${prefix}-${String(nextNum).padStart(6, '0')}`;

        let subtotal = 0;
        const saleItems: Array<{
          productId: string;
          productName: string;
          quantity: number;
          unitPrice: number;
          discount: number;
          total: number;
          costPrice: number;
        }> = [];

        for (const item of saleData.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Product not found: ${item.productId}`);

          const total = item.quantity * product.sellingPrice;
          subtotal += total;

          saleItems.push({
            productId: item.productId,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: product.sellingPrice,
            discount: 0,
            total,
            costPrice: product.costPrice,
          });
        }

        await tx.sale.create({
          data: {
            invoiceNo,
            customerId: saleData.customerId,
            subtotal,
            totalAmount: subtotal,
            amountPaid: subtotal,
            paymentMethod: saleData.paymentMethod,
            status: 'completed',
            createdAt: saleDate,
            items: { create: saleItems },
            payments: {
              create: {
                amount: subtotal,
                method: saleData.paymentMethod,
                status: 'completed',
                createdAt: saleDate,
              },
            },
          },
        });

        // Update invoice number
        if (settings) {
          await tx.storeSettings.update({
            where: { id: settings.id },
            data: { nextInvoiceNo: nextNum + 1 },
          });
        }

        // Deduct stock
        for (const item of saleData.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.quantity } },
          });
        }

        // Add loyalty points
        if (saleData.customerId && settings?.enableLoyalty) {
          const points = Math.floor(subtotal * (settings.loyaltyRate / 100));
          await tx.customer.update({
            where: { id: saleData.customerId },
            data: { loyaltyPoints: { increment: points } },
          });
        }
      });
    }

    // Create some expenses
    await Promise.all([
      db.expense.create({
        data: {
          category: 'Rent',
          amount: 2500,
          description: 'Monthly shop rent',
          date: new Date(),
        },
      }),
      db.expense.create({
        data: {
          category: 'Utilities',
          amount: 350,
          description: 'Electricity bill',
          date: new Date(),
        },
      }),
      db.expense.create({
        data: {
          category: 'Transport',
          amount: 200,
          description: 'Delivery transportation',
          date: new Date(),
        },
      }),
    ]);

    // Create a purchase order
    const purchase = await db.purchase.create({
      data: {
        poNumber: 'PO-000001',
        supplierId: suppliers[0].id,
        subtotal: 600,
        totalAmount: 600,
        status: 'pending',
        items: {
          create: [
            {
              productId: products[3].id,
              productName: products[3].name,
              quantity: 50,
              unitCost: 8,
              total: 400,
            },
            {
              productId: products[5].id,
              productName: products[5].name,
              quantity: 40,
              unitCost: 3,
              total: 120,
            },
            {
              productId: products[7].id,
              productName: products[7].name,
              quantity: 10,
              unitCost: 80,
              total: 800,
            },
          ],
        },
      },
    });

    // Update purchase totals (since we added a third item)
    const totalPurchaseAmount = 400 + 120 + 800;
    await db.purchase.update({
      where: { id: purchase.id },
      data: { subtotal: totalPurchaseAmount, totalAmount: totalPurchaseAmount },
    });

    return NextResponse.json({
      message: 'Demo data seeded successfully',
      stats: {
        categories: categories.length,
        products: products.length,
        suppliers: suppliers.length,
        customers: customers.length,
        sales: salesData.length,
        expenses: 3,
        purchases: 1,
      },
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 });
  }
}
