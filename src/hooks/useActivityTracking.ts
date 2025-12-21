import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ACTIVITY_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useActivityTracking() {
  const { user } = useAuth();
  const lastUpdateRef = useRef<number>(0);

  const updateActivity = useCallback(async () => {
    if (!user) return;

    const now = Date.now();
    // Debounce updates to avoid too many DB calls
    if (now - lastUpdateRef.current < ACTIVITY_UPDATE_INTERVAL) {
      return;
    }

    lastUpdateRef.current = now;

    try {
      await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Update on mount
    updateActivity();

    // Update on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateActivity();
      }
    };

    // Update on user interaction
    const handleUserActivity = () => {
      updateActivity();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    // Periodic update
    const interval = setInterval(updateActivity, ACTIVITY_UPDATE_INTERVAL);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      clearInterval(interval);
    };
  }, [user, updateActivity]);

  return { updateActivity };
}
