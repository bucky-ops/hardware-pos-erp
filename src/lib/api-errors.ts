/**
 * MbumahErrorHandler — Server-side error classification & response builder
 *
 * Provides a centralized way to throw, classify, and serialize errors
 * returned by API routes. All errors flow through `toErrorResponse()` so
 * the client always receives a consistent JSON shape.
 */

import { NextResponse } from 'next/server';
import { PrismaClientKnownRequestError } from '@prisma/client';

// ---------------------------------------------------------------------------
// Error code enum
// ---------------------------------------------------------------------------

export enum ErrorCode {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVALID_PAYMENT = 'INVALID_PAYMENT',
  PRODUCTS_INVALID = 'PRODUCTS_INVALID',
  SALE_VOIDED = 'SALE_VOIDED',
  PURCHASE_RECEIVED = 'PURCHASE_RECEIVED',
  DB_ERROR = 'DB_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  BAD_REQUEST = 'BAD_REQUEST',
}

// ---------------------------------------------------------------------------
// Mapping: ErrorCode → HTTP status
// ---------------------------------------------------------------------------

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.UNKNOWN_ERROR]: 500,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.INSUFFICIENT_STOCK]: 422,
  [ErrorCode.INVALID_PAYMENT]: 400,
  [ErrorCode.PRODUCTS_INVALID]: 422,
  [ErrorCode.SALE_VOIDED]: 400,
  [ErrorCode.PURCHASE_RECEIVED]: 400,
  [ErrorCode.DB_ERROR]: 503,
  [ErrorCode.SERIALIZATION_ERROR]: 500,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.BAD_REQUEST]: 400,
};

// ---------------------------------------------------------------------------
// ApiError class
// ---------------------------------------------------------------------------

export interface ApiErrorContext {
  [key: string]: unknown;
}

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly context: ApiErrorContext;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode?: number,
    details?: unknown,
    context: ApiErrorContext = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode ?? ERROR_STATUS_MAP[code];
    this.details = details;
    this.context = context;
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Classify an unknown thrown value into a well-typed `ApiError`.
 *
 * - If it is already an `ApiError`, return as-is.
 * - Prisma unique-constraint violations (P2002) → CONFLICT
 * - Prisma not-found (P2025) → NOT_FOUND
 * - Other Prisma known errors → DB_ERROR
 * - `TypeError` / `SyntaxError` → VALIDATION_ERROR
 * - Everything else → UNKNOWN_ERROR
 */
export function classifyError(error: unknown): ApiError {
  // Already an ApiError — pass through
  if (error instanceof ApiError) {
    return error;
  }

  // Prisma known request errors
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new ApiError(
          error.message,
          ErrorCode.CONFLICT,
          undefined,
          { prismaCode: error.code, meta: error.meta },
        );
      case 'P2025':
        return new ApiError(
          error.message,
          ErrorCode.NOT_FOUND,
          undefined,
          { prismaCode: error.code, meta: error.meta },
        );
      default:
        return new ApiError(
          error.message,
          ErrorCode.DB_ERROR,
          undefined,
          { prismaCode: error.code, meta: error.meta },
        );
    }
  }

  // TypeError / SyntaxError are usually malformed input
  if (error instanceof TypeError || error instanceof SyntaxError) {
    return new ApiError(
      error instanceof Error ? error.message : String(error),
      ErrorCode.VALIDATION_ERROR,
    );
  }

  // Fallback
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred';

  return new ApiError(message, ErrorCode.UNKNOWN_ERROR);
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

interface ErrorResponseBody {
  message: string;
  code: ErrorCode;
  statusCode: number;
  context: ApiErrorContext;
  stack?: string;
}

/**
 * Convert any thrown value into a `NextResponse` with a consistent JSON body.
 *
 * - Classifies the error via `classifyError()`.
 * - Logs the full error with `console.error` prefixed `[MbumahErrorHandler]`.
 * - Includes `stack` only when `NODE_ENV !== 'production'`.
 */
export function toErrorResponse(error: unknown): NextResponse {
  const apiError = classifyError(error);

  const isDev = process.env.NODE_ENV !== 'production';

  console.error(
    `[MbumahErrorHandler] ${apiError.code} (${apiError.statusCode}): ${apiError.message}`,
  );
  if (apiError.details) {
    console.error('[MbumahErrorHandler] Details:', apiError.details);
  }

  const body: ErrorResponseBody = {
    message: apiError.message,
    code: apiError.code,
    statusCode: apiError.statusCode,
    context: apiError.context,
  };

  if (isDev && apiError.stack) {
    body.stack = apiError.stack;
  }

  return NextResponse.json(body, { status: apiError.statusCode });
}
