import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type BannerVariant = 'unverified' | 'pending' | 'approved';

interface VerificationBannerProps {
  variant?: BannerVariant;
  dismissible?: boolean;
  className?: string;
}

/**
 * VerificationBanner Component
 *
 * Displays a contextual banner based on instructor verification status:
 * - unverified: Prompt to start verification process
 * - pending: Inform that application is under review
 * - approved: Briefly show success (auto-dismisses)
 *
 * Impact: Guides instructors through verification for certificate issuance capability
 */
export function VerificationBanner({
  variant = 'unverified',
  dismissible = true,
  className = '',
}: VerificationBannerProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage for dismissal
  useEffect(() => {
    const dismissedUntil = localStorage.getItem('verification_banner_dismissed');
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    // Dismiss for 24 hours
    const dismissUntil = new Date();
    dismissUntil.setHours(dismissUntil.getHours() + 24);
    localStorage.setItem('verification_banner_dismissed', dismissUntil.toISOString());
    setIsDismissed(true);
  };

  // Don't show if already verified
  if (profile?.is_instructor_verified) {
    return null;
  }

  // Don't show if dismissed
  if (isDismissed) {
    return null;
  }

  const configs = {
    unverified: {
      icon: AlertCircle,
      iconColor: 'text-warning',
      bgColor: 'border-warning/50 bg-warning/5',
      title: 'Complete Your Instructor Verification',
      description: 'Verified instructors can issue certificates and build trust with students.',
      action: 'Verify Now',
      actionPath: '/instructor/verification',
    },
    pending: {
      icon: Clock,
      iconColor: 'text-primary',
      bgColor: 'border-primary/50 bg-primary/5',
      title: 'Verification In Progress',
      description: 'Your instructor application is being reviewed. We\'ll notify you by email within 1-2 business days.',
      action: 'View Status',
      actionPath: '/instructor/verification',
    },
    approved: {
      icon: CheckCircle2,
      iconColor: 'text-success',
      bgColor: 'border-success/50 bg-success/5',
      title: 'Verification Complete!',
      description: 'You can now issue certificates to students who complete your courses.',
      action: null,
      actionPath: null,
    },
  };

  const config = configs[variant];
  const Icon = config.icon;

  return (
    <div
      className={`relative flex items-center gap-3 p-4 rounded-lg border ${config.bgColor} ${className}`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${config.iconColor}`} />
      <div className="flex-1">
        <p className="font-medium text-sm">{config.title}</p>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>
      {config.action && config.actionPath && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1"
          onClick={() => navigate(config.actionPath!)}
        >
          {config.action}
          <ArrowRight className="h-3 w-3" />
        </Button>
      )}
      {dismissible && variant === 'unverified' && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

/**
 * useVerificationStatus Hook
 *
 * Returns the current verification status for display in the banner.
 * Checks both profile verification status and pending requests.
 */
export function useVerificationStatus(): BannerVariant {
  const { profile, user } = useAuth();

  // Query for pending verification requests
  const { data: pendingRequest } = useQuery({
    queryKey: ['instructor-verification-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data } = await supabase
        .from('instructor_role_requests')
        .select('status')
        .eq('user_id', user.id)
        .single();

      return data;
    },
    enabled: !!user?.id && !profile?.is_instructor_verified,
    staleTime: 30000, // Cache for 30 seconds
  });

  if (profile?.is_instructor_verified) {
    return 'approved';
  }

  if (pendingRequest?.status === 'pending') {
    return 'pending';
  }

  return 'unverified';
}
