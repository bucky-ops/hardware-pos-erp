'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/error-reporter';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------
   Error Boundary Internal (Class Component)

   React requires error boundaries to be class components.
   This catches rendering errors in child trees and displays
   a styled fallback UI instead of a blank screen.
   ------------------------------------------------------------------ */

interface ErrorBoundaryInternalProps {
  sectionName?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryInternalState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInternal extends React.Component<
  ErrorBoundaryInternalProps,
  ErrorBoundaryInternalState
> {
  constructor(props: ErrorBoundaryInternalProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryInternalState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError({
      level: 'error',
      message: `[SectionErrorBoundary:${this.props.sectionName || 'Unknown'}] ${error.message}`,
      stack: error.stack,
      component: `SectionErrorBoundary:${this.props.sectionName || 'Unknown'}`,
    });
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className='flex items-center justify-center p-8'>
          <Card className='w-full max-w-md border border-destructive/20 bg-card'>
            <CardContent className='flex flex-col items-center gap-4 p-6 text-center'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10'>
                <AlertTriangle className='h-6 w-6 text-destructive' />
              </div>
              <div className='space-y-1'>
                <h3 className='text-sm font-semibold text-foreground'>
                  Something went wrong
                  {this.props.sectionName && (
                    <span className='text-muted-foreground'> in {this.props.sectionName}</span>
                  )}
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {this.state.error.message}
                </p>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={this.resetErrorBoundary}
                className='mt-1'
              >
                Try Again
              </Button>
              <p className='text-xs text-muted-foreground/60'>
                Error has been reported
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ------------------------------------------------------------------
   Functional Wrapper — SectionErrorBoundary

   Usage:
     <SectionErrorBoundary sectionName="POS">
       <POSComponent />
     </SectionErrorBoundary>
   ------------------------------------------------------------------ */

export function SectionErrorBoundary({
  sectionName,
  children,
}: {
  sectionName?: string;
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundaryInternal sectionName={sectionName}>
      {children}
    </ErrorBoundaryInternal>
  );
}
