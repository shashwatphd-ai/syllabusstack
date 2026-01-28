/**
 * EmailVerificationBanner.tsx
 *
 * PURPOSE: Show warning banner to users who haven't verified their email
 *
 * WHY THIS EXISTS (Task 2.1.1 from MASTER_IMPLEMENTATION_PLAN_V2.md):
 * - Unverified accounts are a security risk
 * - Can be created with any email without proof of ownership
 * - Users may miss verification emails and need a way to resend
 * - Improves UX by making verification status visible
 *
 * WHERE TO USE: Add to MainLayout or authenticated page layouts
 *
 * HOW IT WORKS:
 * 1. Checks user.email_confirmed_at from Supabase Auth
 * 2. Shows banner if email is not verified
 * 3. Provides resend button using Supabase's resend API
 * 4. Can be dismissed (state persisted in session)
 */

import { useState, useCallback } from 'react';
import { AlertTriangle, Mail, X, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SESSION_STORAGE_KEY = 'syllabusstack_email_banner_dismissed';

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    // Check if banner was dismissed in this session
    return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
  });

  // Don't show if:
  // - No user logged in
  // - Email is already verified (email_confirmed_at is set)
  // - Banner was dismissed this session
  if (!user || user.email_confirmed_at || dismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    if (!user.email) {
      toast({
        title: 'Error',
        description: 'No email address found for your account.',
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) throw error;

      toast({
        title: 'Verification email sent',
        description: 'Please check your inbox and spam folder. The link expires in 24 hours.',
      });
    } catch (error) {
      toast({
        title: 'Failed to send email',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
  }, []);

  return (
    <Alert className="mb-4 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30 [&>svg]:text-yellow-600">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-yellow-800 dark:text-yellow-200">
          Please verify your email address (<span className="font-medium">{user.email}</span>) to access all features.
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendVerification}
            disabled={isResending}
            className="border-yellow-600 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-500 dark:text-yellow-300 dark:hover:bg-yellow-950"
          >
            {isResending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Mail className="h-4 w-4 mr-1" />
            )}
            Resend
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-yellow-700 hover:bg-yellow-100 dark:text-yellow-300 dark:hover:bg-yellow-950"
            aria-label="Dismiss verification banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook for checking email verification status
 * Can be used to conditionally render content or enforce verification
 */
export function useEmailVerification() {
  const { user } = useAuth();

  return {
    isVerified: !user || !!user.email_confirmed_at,
    email: user?.email,
    verifiedAt: user?.email_confirmed_at,
  };
}
