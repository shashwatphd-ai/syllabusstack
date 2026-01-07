import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContentStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

export function useContentStats(learningObjectiveIds: string[]) {
  return useQuery({
    queryKey: ['content-stats', learningObjectiveIds],
    queryFn: async (): Promise<ContentStats> => {
      if (learningObjectiveIds.length === 0) {
        return { total: 0, approved: 0, pending: 0, rejected: 0 };
      }

      // Get all content matches for the course's learning objectives
      const { data, error } = await supabase
        .from('content_matches')
        .select('status')
        .in('learning_objective_id', learningObjectiveIds);

      if (error) throw error;

      const stats: ContentStats = {
        total: data?.length || 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      };

      for (const match of data || []) {
        if (match.status === 'approved' || match.status === 'auto_approved') {
          stats.approved++;
        } else if (match.status === 'rejected') {
          stats.rejected++;
        } else {
          stats.pending++;
        }
      }

      return stats;
    },
    enabled: learningObjectiveIds.length > 0,
  });
}

// Get content status per LO for progress indicators
export interface LOContentStatus {
  loId: string;
  hasContent: boolean;
  pendingCount: number;
  approvedCount: number;
}

export function useLOContentStatus(learningObjectiveIds: string[]) {
  return useQuery({
    queryKey: ['lo-content-status', learningObjectiveIds],
    queryFn: async (): Promise<Record<string, LOContentStatus>> => {
      if (learningObjectiveIds.length === 0) return {};

      const { data, error } = await supabase
        .from('content_matches')
        .select('learning_objective_id, status')
        .in('learning_objective_id', learningObjectiveIds);

      if (error) throw error;

      const statusMap: Record<string, LOContentStatus> = {};

      // Initialize all LOs
      for (const loId of learningObjectiveIds) {
        statusMap[loId] = {
          loId,
          hasContent: false,
          pendingCount: 0,
          approvedCount: 0,
        };
      }

      // Count matches per LO
      for (const match of data || []) {
        const loStatus = statusMap[match.learning_objective_id];
        if (loStatus) {
          loStatus.hasContent = true;
          if (match.status === 'approved' || match.status === 'auto_approved') {
            loStatus.approvedCount++;
          } else if (match.status === 'pending') {
            loStatus.pendingCount++;
          }
        }
      }

      return statusMap;
    },
    enabled: learningObjectiveIds.length > 0,
  });
}
