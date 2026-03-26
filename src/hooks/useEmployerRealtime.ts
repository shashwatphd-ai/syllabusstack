import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseEmployerRealtimeOptions {
  companyProfileId: string | undefined;
  enabled?: boolean;
  onUpdate?: () => void;
}

export function useEmployerRealtime({ companyProfileId, enabled = true, onUpdate }: UseEmployerRealtimeOptions) {
  useEffect(() => {
    if (!companyProfileId || !enabled) return;

    const channel = supabase
      .channel(`employer-${companyProfileId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'capstone_applications',
      }, async (payload) => {
        // Check if the application is for one of this company's projects
        const { data } = await supabase
          .from('capstone_projects')
          .select('company_profile_id, title')
          .eq('id', (payload.new as any).capstone_project_id)
          .single();

        if (data?.company_profile_id === companyProfileId) {
          toast.info(`New application for "${data.title}"`);
          onUpdate?.();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'capstone_projects',
        filter: `company_profile_id=eq.${companyProfileId}`,
      }, () => onUpdate?.())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyProfileId, enabled, onUpdate]);
}
