import { ReactNode } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

// Re-export useForm for convenience
export { useForm };

// Type for extracting error messages from TanStack Form's error array
type ErrorItem = string | { message?: string } | unknown;

/**
 * Helper to extract field error message from TanStack Form field state
 * TanStack Form v1 returns an array of errors that can be strings or objects
 */
export function getFieldError(errors: ErrorItem[] | undefined): string | undefined {
  if (!errors || errors.length === 0) return undefined;
  
  const firstError = errors[0];
  if (typeof firstError === 'string') {
    return firstError;
  }
  if (firstError && typeof firstError === 'object' && 'message' in (firstError as object)) {
    return (firstError as { message: string }).message;
  }
  // Handle StandardSchemaV1Issue format
  if (firstError && typeof firstError === 'object') {
    const errorObj = firstError as Record<string, unknown>;
    if ('message' in errorObj) {
      return String(errorObj.message);
    }
  }
  return undefined;
}

/**
 * FormFieldWrapper - Wrapper component for consistent field styling with TanStack Form
 */
interface FormFieldWrapperProps {
  label?: string;
  description?: string;
  error?: string;
  touched?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function FormFieldWrapper({ 
  label, 
  description, 
  error,
  touched,
  children, 
  className,
  htmlFor
}: FormFieldWrapperProps) {
  const showError = error && touched;
  
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label 
          htmlFor={htmlFor} 
          className={cn(showError && "text-destructive")}
        >
          {label}
        </Label>
      )}
      {children}
      {description && !showError && (
        <p className="text-[0.8rem] text-muted-foreground">{description}</p>
      )}
      {showError && (
        <p className="text-[0.8rem] font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}

/**
 * Type helper for form default values from Zod schema
 */
export type FormDefaultValues<T extends z.ZodType> = z.input<T>;
