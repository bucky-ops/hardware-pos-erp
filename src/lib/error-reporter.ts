/**
 * Client-side error reporter
 * Captures unhandled errors and sends them to /api/errors for logging
 */

type ErrorLevel = 'error' | 'warn' | 'info';

interface ErrorReport {
  level: ErrorLevel;
  message: string;
  stack?: string;
  component?: string;
  action?: string;
  url?: string;
  userAgent?: string;
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

/** Wrap a function with automatic error reporting */
export function withErrorReporting<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: { component?: string; action?: string },
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      reportError({
        level: 'error',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        ...context,
      });
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
