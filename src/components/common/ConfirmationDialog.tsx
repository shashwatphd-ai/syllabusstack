/**
 * ConfirmationDialog.tsx
 *
 * PURPOSE: Reusable confirmation dialog for destructive or important actions.
 *
 * WHY THIS WAS CREATED (Task 3.6 from MASTER_IMPLEMENTATION_PLAN.md):
 * - Many destructive actions lacked confirmation prompts
 * - Risk of accidental data loss (delete course, unenroll, revoke API key)
 * - Improves UX by preventing unintended actions
 *
 * WHAT THIS COMPONENT DOES:
 * - Shows a modal dialog before executing destructive actions
 * - Supports different variants (danger, warning, info)
 * - Optional "type to confirm" for extra-critical actions
 * - Loading state during async operations
 *
 * ACTIONS THAT SHOULD USE THIS:
 * - Delete course
 * - Delete dream job
 * - Unenroll from course
 * - Revoke API key
 * - Remove user from organization
 * - Bulk delete operations
 */

import { useState, useCallback } from 'react';
import { Loader2, AlertTriangle, Trash2, Info, ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type ConfirmationVariant = 'danger' | 'warning' | 'info';

export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Title of the confirmation dialog */
  title: string;
  /** Description explaining what will happen */
  description: string;
  /** Variant affects styling (danger=red, warning=yellow, info=blue) */
  variant?: ConfirmationVariant;
  /** Text for the confirm button */
  confirmText?: string;
  /** Text for the cancel button */
  cancelText?: string;
  /** Callback when user confirms - can be async */
  onConfirm: () => void | Promise<void>;
  /** Whether confirm button should show loading state */
  isLoading?: boolean;
  /** If set, user must type this text to confirm (for critical actions) */
  typeToConfirm?: string;
  /** Placeholder text for type-to-confirm input */
  typeToConfirmPlaceholder?: string;
  /** Additional content to show in the dialog body */
  children?: React.ReactNode;
}

const variantConfig: Record<ConfirmationVariant, {
  icon: typeof AlertTriangle;
  iconClass: string;
  buttonClass: string;
}> = {
  danger: {
    icon: Trash2,
    iconClass: 'text-destructive',
    buttonClass: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-yellow-600',
    buttonClass: 'bg-yellow-600 text-white hover:bg-yellow-700',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-600',
    buttonClass: 'bg-blue-600 text-white hover:bg-blue-700',
  },
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'danger',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isLoading = false,
  typeToConfirm,
  typeToConfirmPlaceholder,
  children,
}: ConfirmationDialogProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);

  const config = variantConfig[variant];
  const Icon = config.icon;

  const isConfirmDisabled = typeToConfirm
    ? confirmInput !== typeToConfirm
    : false;

  const loading = isLoading || internalLoading;

  const handleConfirm = useCallback(async () => {
    if (isConfirmDisabled || loading) return;

    setInternalLoading(true);
    try {
      await onConfirm();
      setConfirmInput('');
      onOpenChange(false);
    } catch (error) {
      // Error handling is caller's responsibility
      console.error('Confirmation action failed:', error);
    } finally {
      setInternalLoading(false);
    }
  }, [isConfirmDisabled, loading, onConfirm, onOpenChange]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!loading) {
      if (!newOpen) {
        setConfirmInput('');
      }
      onOpenChange(newOpen);
    }
  }, [loading, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              variant === 'danger' && 'bg-destructive/10',
              variant === 'warning' && 'bg-yellow-100',
              variant === 'info' && 'bg-blue-100',
            )}>
              <Icon className={cn('h-5 w-5', config.iconClass)} />
            </div>
            <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Custom content */}
        {children && (
          <div className="py-2">
            {children}
          </div>
        )}

        {/* Type to confirm */}
        {typeToConfirm && (
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-input" className="text-sm text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{typeToConfirm}</span> to confirm
            </Label>
            <Input
              id="confirm-input"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={typeToConfirmPlaceholder || `Type "${typeToConfirm}"`}
              className="font-mono"
              disabled={loading}
              autoComplete="off"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirmDisabled || loading}
            className={cn(config.buttonClass)}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook for managing confirmation dialog state.
 *
 * USAGE:
 * ```tsx
 * const { confirm, ConfirmDialog } = useConfirmation();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Delete Course?',
 *     description: 'This action cannot be undone.',
 *     variant: 'danger',
 *   });
 *   if (confirmed) {
 *     await deleteCourse(courseId);
 *   }
 * };
 *
 * return (
 *   <>
 *     <Button onClick={handleDelete}>Delete</Button>
 *     <ConfirmDialog />
 *   </>
 * );
 * ```
 */
export interface UseConfirmationOptions {
  title: string;
  description: string;
  variant?: ConfirmationVariant;
  confirmText?: string;
  cancelText?: string;
  typeToConfirm?: string;
}

export function useConfirmation() {
  const [state, setState] = useState<{
    open: boolean;
    options: UseConfirmationOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    options: null,
    resolve: null,
  });

  const confirm = useCallback((options: UseConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState({ open: false, options: null, resolve: null });
  }, [state.resolve]);

  const handleCancel = useCallback((open: boolean) => {
    if (!open) {
      state.resolve?.(false);
      setState({ open: false, options: null, resolve: null });
    }
  }, [state.resolve]);

  const ConfirmDialog = useCallback(() => {
    if (!state.options) return null;

    return (
      <ConfirmationDialog
        open={state.open}
        onOpenChange={handleCancel}
        onConfirm={handleConfirm}
        {...state.options}
      />
    );
  }, [state, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog };
}

/**
 * Pre-configured confirmation for delete actions.
 */
export interface DeleteConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  itemType: string;
  itemName?: string;
  requireTypeConfirm?: boolean;
}

export function DeleteConfirmation({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  itemType,
  itemName,
  requireTypeConfirm = false,
}: DeleteConfirmationProps) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      isLoading={isLoading}
      variant="danger"
      title={`Delete ${itemType}?`}
      description={
        itemName
          ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
          : `Are you sure you want to delete this ${itemType.toLowerCase()}? This action cannot be undone.`
      }
      confirmText="Delete"
      typeToConfirm={requireTypeConfirm ? 'DELETE' : undefined}
    />
  );
}
