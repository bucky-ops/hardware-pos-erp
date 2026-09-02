/**
 * MbumahErrorHandler — Client-side structured error handler
 *
 * Provides utilities to parse structured API error responses from the server,
 * map them to user-friendly messages, and display toast notifications.
 */

import { toast } from 'sonner';
import { ErrorCode } from './api-errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StructuredApiError {
  message: string;
  code: ErrorCode;
  statusCode: number;
  context: Record<string, unknown>;
  stack?: string;
  /** True when statusCode >= 500 */
  isServerError: boolean;
  /** True when statusCode >= 400 && statusCode < 500 */
  isClientError: boolean;
  /** True when the request is worth retrying (5xx / network issues) */
  isRetryable: boolean;
}

// ---------------------------------------------------------------------------
// User-friendly message map
// ---------------------------------------------------------------------------

const USER_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNKNOWN_ERROR]:
    'An unexpected error occurred. Please try again.',
  [ErrorCode.VALIDATION_ERROR]:
    'Please check your input and try again.',
  [ErrorCode.NOT_FOUND]:
    'The requested resource could not be found.',
  [ErrorCode.CONFLICT]:
    'This record already exists.',
  [ErrorCode.INSUFFICIENT_STOCK]:
    'Not enough stock available.',
  [ErrorCode.INVALID_PAYMENT]:
    'The selected payment method is not valid.',
  [ErrorCode.PRODUCTS_INVALID]:
    'Some items in your cart are no longer available.',
  [ErrorCode.SALE_VOIDED]:
    'This sale has already been voided.',
  [ErrorCode.PURCHASE_RECEIVED]:
    'This purchase has already been received.',
  [ErrorCode.DB_ERROR]:
    'A database error occurred. Please try again later.',
  [ErrorCode.SERIALIZATION_ERROR]:
    'Failed to process the response. Please try again.',
  [ErrorCode.UNAUTHORIZED]:
    'You need to sign in to perform this action.',
  [ErrorCode.FORBIDDEN]:
    'You do not have permission to perform this action.',
  [ErrorCode.RATE_LIMITED]:
    'Too many requests. Please wait a moment and try again.',
  [ErrorCode.BAD_REQUEST]:
    'The request could not be processed. Please check your input.',
};

// ---------------------------------------------------------------------------
// Retryable status codes
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);

// ---------------------------------------------------------------------------
// MbumahErrorHandler
// ---------------------------------------------------------------------------

class MbumahErrorHandler {
  /** Status codes that indicate the request may succeed on retry */
  public readonly retryableStatusCodes: Set<number> = RETRYABLE_STATUS_CODES;

  /**
   * Parse a fetch `Response` into a `StructuredApiError`.
   *
   * Attempts to read a structured JSON body from the server. If the body
   * cannot be parsed or lacks expected fields, a synthetic error is returned.
   */
  async handleApiError(response: Response): Promise<StructuredApiError> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    const obj = body as Record<string, unknown> | null;
    const statusCode = response.status;
    const isServerError = statusCode >= 500;
    const isClientError = statusCode >= 400 && statusCode < 500;
    const isRetryable = RETRYABLE_STATUS_CODES.has(statusCode);

    // If the server returned a structured error body, use it
    if (
      obj &&
      typeof obj === 'object' &&
      typeof obj.message === 'string' &&
      typeof obj.code === 'string' &&
      typeof obj.statusCode === 'number'
    ) {
      return {
        message: obj.message,
        code: obj.code as ErrorCode,
        statusCode: obj.statusCode,
        context: (typeof obj.context === 'object' && obj.context
          ? (obj.context as Record<string, unknown>)
          : {}),
        stack: typeof obj.stack === 'string' ? obj.stack : undefined,
        isServerError,
        isClientError,
        isRetryable,
      };
    }

    // Fallback: construct a synthetic error from the HTTP status
    const fallbackCode = this.httpStatusToErrorCode(statusCode);
    return {
      message:
        (obj && typeof obj.message === 'string' ? obj.message : null) ??
        response.statusText ??
        'An unexpected error occurred',
      code: fallbackCode,
      statusCode,
      context: {},
      isServerError,
      isClientError,
      isRetryable,
    };
  }

  /**
   * Map a server error code to a user-friendly message.
   */
  getUserMessage(error: StructuredApiError): string {
    return USER_MESSAGES[error.code] ?? USER_MESSAGES[ErrorCode.UNKNOWN_ERROR];
  }

  /**
   * Display a sonner toast for the given structured error.
   *
   * - 5xx → `error` variant (red)
   * - 4xx → `warning` variant (orange)
   * - Others → `info` variant (blue)
   */
  showToast(error: StructuredApiError): void {
    const userMessage = this.getUserMessage(error);

    if (error.isServerError) {
      toast.error(userMessage);
    } else if (error.isClientError) {
      toast.warning(userMessage);
    } else {
      toast.info(userMessage);
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Map a raw HTTP status code to the closest ErrorCode */
  private httpStatusToErrorCode(statusCode: number): ErrorCode {
    switch (statusCode) {
      case 400:
        return ErrorCode.BAD_REQUEST;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 422:
        return ErrorCode.VALIDATION_ERROR;
      case 429:
        return ErrorCode.RATE_LIMITED;
      case 503:
        return ErrorCode.DB_ERROR;
      default:
        return ErrorCode.UNKNOWN_ERROR;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const errorHandler = new MbumahErrorHandler();
