import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ErrorCode, toErrorResponse } from '@/lib/api-errors';

/** POST /api/errors — Log a client-side error */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { level, code, statusCode, message, stack, component, action, url, userAgent } = body;

    if (!message) {
      return NextResponse.json(
        new ApiError('Message is required', ErrorCode.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    await db.errorLog.create({
      data: {
        level: level || 'error',
        code: code ? String(code).slice(0, 50) : null,
        statusCode: statusCode ? parseInt(statusCode, 10) : null,
        message: String(message).slice(0, 2000),
        stack: stack ? String(stack).slice(0, 5000) : null,
        component: component ? String(component).slice(0, 100) : null,
        action: action ? String(action).slice(0, 200) : null,
        url: url ? String(url).slice(0, 500) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 300) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Never let error logging cause a cascading failure
    console.error('Error logging failed:', error);
    return NextResponse.json({ ok: true });
  }
}

/** GET /api/errors — List error logs */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);
    const level = searchParams.get('level');
    const resolved = searchParams.get('resolved');

    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (resolved !== null && resolved !== undefined && resolved !== '') {
      where.resolved = resolved === 'true';
    }

    const [errors, total, unresolvedCount] = await Promise.all([
      db.errorLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.errorLog.count({ where }),
      db.errorLog.count({ where: { resolved: false } }),
    ]);

    return NextResponse.json({ errors, total, page, limit, unresolvedCount });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/errors — Clear resolved errors */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clearAll = searchParams.get('all');

    if (clearAll === 'true') {
      await db.errorLog.deleteMany();
    } else {
      await db.errorLog.deleteMany({ where: { resolved: true } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH /api/errors — Mark error as resolved */
export async function PATCH(request: NextRequest) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        new ApiError('ids array required', ErrorCode.VALIDATION_ERROR),
        { status: 400 },
      );
    }
    await db.errorLog.updateMany({ where: { id: { in: ids } }, data: { resolved: true } });
    return NextResponse.json({ ok: true, resolved: ids.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}
