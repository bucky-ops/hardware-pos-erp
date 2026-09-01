import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/settings - Get settings or create default
export async function GET() {
  try {
    let settings = await db.storeSettings.findFirst();

    if (!settings) {
      settings = await db.storeSettings.create({
        data: {},
      });
    }

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PATCH /api/settings - Update settings
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    let settings = await db.storeSettings.findFirst();

    if (!settings) {
      settings = await db.storeSettings.create({
        data: {
          ...(body.storeName !== undefined && { storeName: body.storeName }),
          ...(body.address !== undefined && { address: body.address }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.email !== undefined && { email: body.email }),
          ...(body.taxRate !== undefined && { taxRate: parseFloat(body.taxRate) }),
          ...(body.currency !== undefined && { currency: body.currency }),
          ...(body.currencySymbol !== undefined && { currencySymbol: body.currencySymbol }),
          ...(body.invoicePrefix !== undefined && { invoicePrefix: body.invoicePrefix }),
          ...(body.enableLoyalty !== undefined && { enableLoyalty: Boolean(body.enableLoyalty) }),
          ...(body.loyaltyRate !== undefined && { loyaltyRate: parseFloat(body.loyaltyRate) }),
          ...(body.receiptFooter !== undefined && { receiptFooter: body.receiptFooter }),
        },
      });
    } else {
      settings = await db.storeSettings.update({
        where: { id: settings.id },
        data: {
          ...(body.storeName !== undefined && { storeName: body.storeName }),
          ...(body.address !== undefined && { address: body.address }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.email !== undefined && { email: body.email }),
          ...(body.taxRate !== undefined && { taxRate: parseFloat(body.taxRate) }),
          ...(body.currency !== undefined && { currency: body.currency }),
          ...(body.currencySymbol !== undefined && { currencySymbol: body.currencySymbol }),
          ...(body.invoicePrefix !== undefined && { invoicePrefix: body.invoicePrefix }),
          ...(body.enableLoyalty !== undefined && { enableLoyalty: Boolean(body.enableLoyalty) }),
          ...(body.loyaltyRate !== undefined && { loyaltyRate: parseFloat(body.loyaltyRate) }),
          ...(body.receiptFooter !== undefined && { receiptFooter: body.receiptFooter }),
        },
      });
    }

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
