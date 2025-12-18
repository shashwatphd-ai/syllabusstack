import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
};

export function PageContainer({ 
  children, 
  className,
  maxWidth = 'xl'
}: PageContainerProps) {
  return (
    <div className={cn(
      "w-full mx-auto px-4 sm:px-6 lg:px-8 py-6",
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ 
  title, 
  description, 
  action,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8",
      className
    )}>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function Section({ 
  title, 
  description, 
  children, 
  className,
  action 
}: SectionProps) {
  return (
    <section className={cn("mb-8", className)}>
      {(title || description || action) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
