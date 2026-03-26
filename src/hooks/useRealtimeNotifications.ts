import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeNotificationContext } from "@/contexts/NotificationContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export function useRealtimeNotifications() {
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-realtime'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['user-roles-rt'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      return (data || []).map((r: any) => r.role as string);
    },
  });

  const isStudent = roles.includes('student');
  const isInstructor = roles.includes('instructor');
  const { addNotification } = useRealtimeNotificationContext();

  useEffect(() => {
    if (!currentUser) return;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (isStudent) {
      const appChannel = supabase
        .channel("student-apps-rt")
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "capstone_applications",
          filter: `student_id=eq.${currentUser.id}`,
        }, (payload) => {
          const updated = payload.new as any;
          const old = payload.old as any;
          if (updated.status !== old.status) {
            const title = "Application Update";
            const message = `Your application status changed to ${updated.status}`;
            addNotification({ type: "application_status", title, message });
            toast.info(title, { description: message });
          }
        })
        .subscribe();
      channels.push(appChannel);
    }

    if (isInstructor) {
      const genChannel = supabase
        .channel("instructor-gen-rt")
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "capstone_generation_runs",
          filter: `started_by=eq.${currentUser.id}`,
        }, (payload) => {
          const updated = payload.new as any;
          if (updated.status === "completed") {
            const title = "Generation Complete";
            const message = `${updated.projects_generated || 0} projects generated`;
            addNotification({ type: "generation_complete", title, message });
            toast.success(title, { description: message });
          }
        })
        .subscribe();
      channels.push(genChannel);
    }

    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [currentUser, isStudent, isInstructor, addNotification]);
}
