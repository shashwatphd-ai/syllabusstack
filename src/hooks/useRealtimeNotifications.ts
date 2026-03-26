import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeNotificationContext } from "@/contexts/NotificationContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

/**
 * Subscribes to realtime Postgres changes for role-specific notifications.
 * Adapted from EduThree1 — uses SyllabusStack table names.
 */
export function useRealtimeNotifications() {
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-realtime'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { isStudent, isInstructor, isEmployer } = useUserRoles();
  const { addNotification } = useRealtimeNotificationContext();

  useEffect(() => {
    if (!currentUser) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Student: new job matches
    if (isStudent) {
      const jobMatchChannel = supabase
        .channel("student-job-matches-rt")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "job_matches",
            filter: `user_id=eq.${currentUser.id}`,
          },
          (payload) => {
            const m = payload.new as any;
            const title = "New Job Match!";
            const message = `${m.job_title || "A new position"} at ${m.company_name || "a company"}`;
            addNotification({ type: "job_match", title, message, data: { matchId: m.id } });
            toast.success(title, { description: message });
          }
        )
        .subscribe();
      channels.push(jobMatchChannel);

      // Student: capstone application status changes
      const appChannel = supabase
        .channel("student-apps-rt")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "capstone_applications",
            filter: `student_id=eq.${currentUser.id}`,
          },
          (payload) => {
            const updated = payload.new as any;
            const old = payload.old as any;
            if (updated.status !== old.status) {
              const labels: Record<string, string> = {
                approved: "approved! 🎉",
                rejected: "not selected",
                pending: "under review",
              };
              const title = "Application Update";
              const message = `Your application has been ${labels[updated.status] || updated.status}`;
              addNotification({ type: "application_status", title, message, data: { applicationId: updated.id, status: updated.status } });
              if (updated.status === "approved") {
                toast.success(title, { description: message });
              } else {
                toast.info(title, { description: message });
              }
            }
          }
        )
        .subscribe();
      channels.push(appChannel);
    }

    // Instructor: capstone generation run completion
    if (isInstructor) {
      const genChannel = supabase
        .channel("instructor-gen-rt")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "capstone_generation_runs",
            filter: `started_by=eq.${currentUser.id}`,
          },
          (payload) => {
            const updated = payload.new as any;
            const old = payload.old as any;
            if (updated.status !== old.status) {
              if (updated.status === "completed") {
                const title = "Generation Complete";
                const message = `${updated.projects_generated || 0} projects generated successfully`;
                addNotification({ type: "generation_complete", title, message, data: { runId: updated.id } });
                toast.success(title, { description: message });
              } else if (updated.status === "failed") {
                toast.error("Generation failed", { description: "Check the generation log for details" });
              }
            }
          }
        )
        .subscribe();
      channels.push(genChannel);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [currentUser, isStudent, isInstructor, isEmployer, addNotification]);
}
