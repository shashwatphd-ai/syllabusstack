import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseInstructorRealtimeOptions {
  userId: string | undefined;
  enabled?: boolean;
  onUpdate?: () => void;
}

export function useInstructorRealtime({ userId, enabled = true, onUpdate }: UseInstructorRealtimeOptions) {
  useEffect(() => {
    if (!userId || !enabled) return;

    const channel = supabase
      .channel(`instructor-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'capstone_generation_runs',
        filter: `started_by=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.status === 'completed') {
          toast.success(`${updated.projects_generated || 0} capstone projects generated`);
          onUpdate?.();
        } else if (updated.status === 'failed') {
          toast.error('Capstone generation failed');
          onUpdate?.();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, enabled, onUpdate]);
}
