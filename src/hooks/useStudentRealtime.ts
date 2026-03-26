import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseStudentRealtimeOptions {
  studentId: string | undefined;
  enabled?: boolean;
  onUpdate?: () => void;
}

export function useStudentRealtime({ studentId, enabled = true, onUpdate }: UseStudentRealtimeOptions) {
  useEffect(() => {
    if (!studentId || !enabled) return;

    const channel = supabase
      .channel(`student-${studentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'capstone_applications',
        filter: `student_id=eq.${studentId}`,
      }, (payload) => {
        const newStatus = (payload.new as any).status;
        if (newStatus === 'approved') {
          toast.success('Your capstone application was approved!');
        } else if (newStatus === 'rejected') {
          toast.info('Capstone application status updated');
        }
        onUpdate?.();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'job_matches',
        filter: `user_id=eq.${studentId}`,
      }, () => {
        toast.info('New job match found!');
        onUpdate?.();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [studentId, enabled, onUpdate]);
}
