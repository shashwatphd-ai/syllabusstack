import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingState({ 
  message = "Loading...", 
  size = 'md',
  className 
}: LoadingStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 gap-4",
      className
    )}>
      <Loader2 className={cn(
        "animate-spin text-primary",
        sizeClasses[size]
      )} />
      {message && (
        <p className="text-muted-foreground text-sm animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("h-4 w-4 animate-spin", className)} />
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
        <p className="text-muted-foreground">Loading EduThree...</p>
      </div>
    </div>
  );
}
