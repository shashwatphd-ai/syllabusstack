import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Specialized error boundary for recommendation components.
 * Provides recovery options specific to the recommendations flow.
 */
export class RecommendationsErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Structured logging for debugging
    console.error(JSON.stringify({
      level: 'error',
      component: this.props.componentName || 'RecommendationsErrorBoundary',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    }));
    
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onReset?.();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full p-4">
          <Card className="max-w-lg mx-auto border-destructive/30 bg-destructive/5">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-lg">Failed to Load Recommendations</CardTitle>
              <CardDescription className="text-muted-foreground">
                We encountered an issue displaying your action plan. This is usually temporary.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <Alert variant="destructive" className="bg-background">
                  <AlertTitle className="text-sm font-medium">Error Details</AlertTitle>
                  <AlertDescription className="text-xs font-mono mt-1 break-all">
                    {this.state.error.message}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={this.handleRetry} 
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
              </div>
              
              <p className="text-xs text-center text-muted-foreground">
                If this problem persists, try refreshing the page or contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Inline error display for recoverable errors in recommendations
 */
interface InlineErrorProps {
  error: Error | null;
  onRetry?: () => void;
  className?: string;
}

export function RecommendationsInlineError({ error, onRetry, className }: InlineErrorProps) {
  if (!error) return null;
  
  // Check if it's a rate limit error
  const isRateLimit = error.message?.toLowerCase().includes('rate limit') || 
                      error.message?.includes('429');
  
  return (
    <Alert 
      variant={isRateLimit ? 'default' : 'destructive'} 
      className={className}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {isRateLimit ? 'Rate Limit Reached' : 'Error Loading Data'}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{error.message}</span>
        {onRetry && !isRateLimit && (
          <Button 
            onClick={onRetry} 
            variant="outline" 
            size="sm" 
            className="w-fit"
          >
            <RefreshCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
        {isRateLimit && (
          <span className="text-xs text-muted-foreground">
            Please wait a moment before trying again.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
