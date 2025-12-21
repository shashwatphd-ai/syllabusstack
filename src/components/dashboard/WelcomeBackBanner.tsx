import { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface WelcomeBackBannerProps {
  onDismiss?: () => void;
}

export function WelcomeBackBanner({ onDismiss }: WelcomeBackBannerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [daysSinceActive, setDaysSinceActive] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user) {
      checkInactivity();
    }
  }, [user]);

  const checkInactivity = async () => {
    if (!user) return;

    try {
      // Get last active timestamp
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_active_at')
        .eq('user_id', user.id)
        .single();

      if (profile?.last_active_at) {
        const lastActive = new Date(profile.last_active_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastActive.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Show banner if inactive for 3+ days
        if (diffDays >= 3) {
          setDaysSinceActive(diffDays);
          
          // Get pending recommendations count
          const { count } = await supabase
            .from('recommendations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'pending');
          
          setPendingCount(count || 0);
          setShow(true);
        }
      }
    } catch (error) {
      console.error('Error checking inactivity:', error);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    onDismiss?.();
  };

  const handleViewRecommendations = () => {
    navigate('/recommendations');
    handleDismiss();
  };

  if (!show) return null;

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <CardContent className="pt-6 pb-4">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-foreground">
              Welcome back! 👋
            </h3>
            <p className="text-sm text-muted-foreground">
              {daysSinceActive === 1 
                ? "You've been away for a day." 
                : `You've been away for ${daysSinceActive} days.`}
              {pendingCount > 0 && (
                <span className="font-medium text-foreground">
                  {' '}You have {pendingCount} pending recommendation{pendingCount !== 1 ? 's' : ''} waiting for you!
                </span>
              )}
            </p>
            
            {pendingCount > 0 && (
              <Button 
                size="sm" 
                className="mt-2"
                onClick={handleViewRecommendations}
              >
                View Recommendations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
