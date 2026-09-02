/**
 * Client-side error reporter
 * Captures unhandled errors and sends them to /api/errors for logging.
 *
 * Enhanced to parse structured API errors via MbumahErrorHandler,
 * including error `code` and `statusCode` in the report.
 */

import { errorHandler, type StructuredApiError } from './mbumah-error-handler';

type ErrorLevel = 'error' | 'warn' | 'info';

interface ErrorReport {
  level: ErrorLevel;
  message: string;
  stack?: string;
  component?: string;
  action?: string;
  url?: string;
  userAgent?: string;
  /** Structured error code from the server (e.g. CONFLICT, NOT_FOUND) */
  code?: string;
  /** HTTP status code from the server response */
  statusCode?: number;
}

/** Send error to server for persistent logging */
export async function reportError(report: ErrorReport): Promise<void> {
  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...report,
        url: report.url || (typeof window !== 'undefined' ? window.location.href : undefined),
        userAgent: report.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      }),
    });
  } catch {
    // Silent fail — don't loop errors
  }
}

/**
 * Parse an API response into a StructuredApiError, then report it.
 *
 * This is the recommended way to handle failed fetch responses when you
 * also want the error persisted to the error log.
 */
export async function reportApiError(
  response: Response,
  context?: { component?: string; action?: string },
): Promise<StructuredApiError> {
  const structured = await errorHandler.handleApiError(response);

  reportError({
    level: structured.isServerError ? 'error' : 'warn',
    message: structured.message,
    code: structured.code,
    statusCode: structured.statusCode,
    ...context,
  });

  return structured;
}

/** Wrap a function with automatic error reporting */
export function withErrorReporting<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: { component?: string; action?: string },
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      // If the caught value is a Response (e.g. from fetch), parse it as a structured API error
      if (err instanceof Response) {
        await reportApiError(err, context);
      } else {
        reportError({
          level: 'error',
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          ...context,
        });
      }
      throw err;
    }
  }) as T;
}

/** Global error event handler setup — call once in layout */
export function initGlobalErrorReporting() {
  if (typeof window === 'undefined') return;

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      level: 'error',
      message: `Unhandled Promise Rejection: ${event.reason?.message || String(event.reason)}`,
      stack: event.reason?.stack,
    });
  });

  // Capture uncaught errors (supplemental to React error boundary)
  window.addEventListener('error', (event) => {
    reportError({
      level: 'error',
      message: event.message,
      stack: event.error?.stack,
      component: 'Global',
    });
  });
}
