import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Certificate {
  id: string;
  certificate_number: string;
  certificate_type: "completion_badge" | "verified" | "assessed";
  course_title: string;
  instructor_name: string | null;
  institution_name: string | null;
  mastery_score: number | null;
  identity_verified: boolean;
  instructor_verified: boolean;
  completion_date: string;
  issued_at: string | null;
  share_token: string;
  status: string;
  skill_breakdown: Record<string, number> | null;
}

export function useCertificates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["certificates", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("issued_at", { ascending: false });

      if (error) throw error;
      return data as Certificate[];
    },
    enabled: !!user,
  });
}

export function useCertificateStats() {
  const { data: certificates = [], isLoading } = useCertificates();

  const stats = {
    total: certificates.length,
    assessed: certificates.filter(c => c.certificate_type === "assessed").length,
    verified: certificates.filter(c => c.certificate_type === "verified").length,
    badges: certificates.filter(c => c.certificate_type === "completion_badge").length,
    avgMasteryScore: certificates
      .filter(c => c.mastery_score !== null)
      .reduce((acc, c) => acc + (c.mastery_score || 0), 0) / 
      (certificates.filter(c => c.mastery_score !== null).length || 1),
  };

  return { stats, isLoading };
}
