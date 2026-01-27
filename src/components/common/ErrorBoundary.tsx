import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home, MessageCircle, WifiOff, Lock, ShieldAlert, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { parseAPIError, createErrorInfo, logError, type APIError, type ErrorType } from '@/lib/api-error-handler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showReportButton?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  parsedError?: APIError;
}

// Get icon based on error type
const getErrorIcon = (type: ErrorType) => {
  switch (type) {
    case 'network':
      return WifiOff;
    case 'auth':
      return Lock;
    case 'permission':
      return ShieldAlert;
    case 'server':
      return Server;
    default:
      return AlertTriangle;
  }
};

// Get friendly title based on error type
const getErrorTitle = (type: ErrorType) => {
  switch (type) {
    case 'network':
      return 'Connection Problem';
    case 'auth':
      return 'Authentication Required';
    case 'permission':
      return 'Access Denied';
    case 'server':
      return 'Server Error';
    case 'validation':
      return 'Invalid Data';
    case 'not_found':
      return 'Not Found';
    case 'rate_limit':
      return 'Too Many Requests';
    default:
      return 'Something Went Wrong';
  }
};

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const parsedError = parseAPIError(error);
    return { hasError: true, error, parsedError };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with formatting
    logError('ErrorBoundary', error);

    // Create detailed error info
    const errorDetails = createErrorInfo(error, errorInfo.componentStack || undefined);
    console.error('Error details:', errorDetails);

    // Call optional callback
    this.props.onError?.(error, errorInfo);

    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, parsedError: undefined });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReportError = () => {
    const { error, parsedError, errorInfo } = this.state;
    const errorReport = {
      message: error?.message,
      type: parsedError?.type,
      code: parsedError?.code,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      componentStack: errorInfo?.componentStack,
    };

    // Copy error details to clipboard
    navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
      .then(() => alert('Error details copied to clipboard. Please include them in your bug report.'))
      .catch(() => console.log('Failed to copy error details'));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { parsedError } = this.state;
      const errorType = parsedError?.type || 'unknown';
      const ErrorIcon = getErrorIcon(errorType);
      const errorTitle = getErrorTitle(errorType);

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <ErrorIcon className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>{errorTitle}</CardTitle>
              <CardDescription>
                {parsedError?.message || 'We encountered an unexpected error.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Suggested action */}
              {parsedError?.suggestedAction && (
                <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-lg p-3 text-sm">
                  {parsedError.suggestedAction}
                </div>
              )}

              {/* Error details (collapsible in production) */}
              {this.state.error && parsedError?.code && (
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                    Technical details
                  </summary>
                  <div className="bg-muted rounded-lg p-3 mt-2">
                    <p className="font-mono break-all">
                      Code: {parsedError.code}
                    </p>
                    {parsedError.details && (
                      <p className="font-mono break-all mt-1">
                        {parsedError.details}
                      </p>
                    )}
                  </div>
                </details>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {parsedError?.retryable && (
                  <Button
                    onClick={this.handleRetry}
                    className="flex-1"
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className={parsedError?.retryable ? '' : 'flex-1'}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>
            </CardContent>

            {this.props.showReportButton !== false && (
              <CardFooter className="justify-center border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleReportError}
                  className="text-muted-foreground"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Report this issue
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based error display for async errors
interface ErrorDisplayProps {
  error: Error | null;
  onRetry?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
}

export function ErrorDisplay({
  error,
  onRetry,
  title,
  className,
  compact = false,
}: ErrorDisplayProps) {
  if (!error) return null;

  const parsedError = parseAPIError(error);
  const ErrorIcon = getErrorIcon(parsedError.type);
  const displayTitle = title || getErrorTitle(parsedError.type);

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 bg-destructive/10 rounded-lg ${className || ''}`}>
        <ErrorIcon className="h-5 w-5 text-destructive flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{parsedError.message}</p>
          {parsedError.suggestedAction && (
            <p className="text-xs text-muted-foreground mt-0.5">{parsedError.suggestedAction}</p>
          )}
        </div>
        {onRetry && parsedError.retryable && (
          <Button onClick={onRetry} variant="ghost" size="sm">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ErrorIcon className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg">{displayTitle}</CardTitle>
          </div>
          <CardDescription className="text-destructive/80">
            {parsedError.message}
          </CardDescription>
          {parsedError.suggestedAction && (
            <p className="text-sm text-muted-foreground mt-2">
              {parsedError.suggestedAction}
            </p>
          )}
        </CardHeader>
        {(onRetry && parsedError.retryable) && (
          <CardContent>
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// Inline error message for form fields or small areas
interface InlineErrorProps {
  error: Error | string | null;
  className?: string;
}

export function InlineError({ error, className }: InlineErrorProps) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : parseAPIError(error).message;

  return (
    <p className={`text-sm text-destructive flex items-center gap-1 ${className || ''}`}>
      <AlertTriangle className="h-3 w-3" />
      {message}
    </p>
  );
}

// Full page error for route-level errors
interface FullPageErrorProps {
  error: Error;
  onRetry?: () => void;
  onGoBack?: () => void;
}

export function FullPageError({ error, onRetry, onGoBack }: FullPageErrorProps) {
  const parsedError = parseAPIError(error);
  const ErrorIcon = getErrorIcon(parsedError.type);
  const errorTitle = getErrorTitle(parsedError.type);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <ErrorIcon className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{errorTitle}</h1>
        <p className="text-muted-foreground mb-4">{parsedError.message}</p>
        {parsedError.suggestedAction && (
          <p className="text-sm text-muted-foreground mb-6 bg-muted/50 rounded-lg p-3">
            {parsedError.suggestedAction}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          {onGoBack && (
            <Button variant="outline" onClick={onGoBack}>
              Go Back
            </Button>
          )}
          {onRetry && parsedError.retryable && (
            <Button onClick={onRetry}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.location.href = '/'}>
            <Home className="h-4 w-4 mr-2" />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
