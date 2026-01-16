import { forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 12;
  className?: string;
}

const columnClasses = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
  12: 'grid-cols-1 lg:grid-cols-12',
};

/**
 * ResponsiveGrid - A grid container that automatically handles responsive breakpoints.
 * Use this for dashboard-style layouts with consistent responsive behavior.
 * 
 * @example
 * <ResponsiveGrid columns={3}>
 *   <Card>...</Card>
 *   <Card>...</Card>
 *   <Card>...</Card>
 * </ResponsiveGrid>
 */
export const ResponsiveGrid = forwardRef<HTMLDivElement, ResponsiveGridProps>(
  function ResponsiveGrid({ children, columns = 3, className }, ref) {
    return (
      <div
        ref={ref}
        className={cn('grid gap-4 sm:gap-6', columnClasses[columns], className)}
      >
        {children}
      </div>
    );
  }
);

interface ResponsiveStackProps {
  children: ReactNode;
  className?: string;
  /** Reverse order on mobile (useful for forms with submit button first on mobile) */
  reverse?: boolean;
}

/**
 * ResponsiveStack - A flex container that stacks vertically on mobile and horizontally on larger screens.
 * Use this for button groups, action bars, and header layouts.
 * 
 * @example
 * <ResponsiveStack>
 *   <Button variant="outline">Cancel</Button>
 *   <Button>Submit</Button>
 * </ResponsiveStack>
 */
export const ResponsiveStack = forwardRef<HTMLDivElement, ResponsiveStackProps>(
  function ResponsiveStack({ children, className, reverse = false }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col sm:flex-row gap-2 sm:gap-3',
          reverse && 'flex-col-reverse sm:flex-row',
          className
        )}
      >
        {children}
      </div>
    );
  }
);

interface ResponsiveTextProps {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  size?: 'lg' | 'xl' | '2xl';
  className?: string;
}

const textSizeClasses = {
  lg: 'text-lg sm:text-xl lg:text-2xl',
  xl: 'text-xl sm:text-2xl lg:text-3xl',
  '2xl': 'text-2xl sm:text-3xl lg:text-4xl',
};

/**
 * ResponsiveText - Text that scales with viewport size.
 * Use this for headings and important text that needs to be readable on all devices.
 */
export const ResponsiveText = forwardRef<HTMLElement, ResponsiveTextProps>(
  function ResponsiveText({ children, as: Component = 'span', size = 'lg', className }, ref) {
    return (
      <Component
        ref={ref as React.Ref<HTMLHeadingElement>}
        className={cn(textSizeClasses[size], className)}
      >
        {children}
      </Component>
    );
  }
);
