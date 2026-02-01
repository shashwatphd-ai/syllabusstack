/**
 * Placement Outcomes Tracking Hook
 *
 * Enables users to record job application outcomes for:
 * 1. Training career-outcome embeddings
 * 2. Improving skill-to-job matching algorithms
 * 3. Validating gap analysis accuracy
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type OutcomeType = 'hired' | 'interview' | 'rejected' | 'withdrew' | 'offer_declined';

export interface PlacementOutcome {
  id: string;
  dream_job_id?: string;
  outcome_type: OutcomeType;
  job_title: string;
  company_name?: string;
  application_date?: string;
  outcome_date?: string;
  is_successful?: boolean;
  salary_band?: string;
  skills_snapshot: any[];
  verified_skills_count: number;
  created_at: string;
}

export interface NewOutcome {
  dream_job_id?: string;
  outcome_type: OutcomeType;
  job_title: string;
  company_name?: string;
  application_date?: string;
  outcome_date?: string;
  is_successful?: boolean;
  salary_band?: string;
}

export function usePlacementOutcomes() {
  const { user } = useAuth();
  const [outcomes, setOutcomes] = useState<PlacementOutcome[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Record a new placement outcome
   * Automatically snapshots current verified skills
   */
  const recordOutcome = useCallback(async (outcome: NewOutcome): Promise<{
    data?: PlacementOutcome;
    error?: string;
  }> => {
    if (!user) {
      return { error: 'Not authenticated' };
    }

    setLoading(true);
    setError(null);

    try {
      // Get current skills snapshot
      const { data: skills, error: skillsError } = await supabase
        .from('verified_skills')
        .select('skill_name, proficiency_level, verified_at, source_type')
        .eq('user_id', user.id);

      if (skillsError) {
        console.warn('Failed to fetch skills snapshot:', skillsError);
      }

      // Insert outcome
      const { data, error: insertError } = await supabase
        .from('placement_outcomes')
        .insert({
          user_id: user.id,
          dream_job_id: outcome.dream_job_id,
          outcome_type: outcome.outcome_type,
          job_title: outcome.job_title,
          company_name: outcome.company_name,
          application_date: outcome.application_date,
          outcome_date: outcome.outcome_date,
          is_successful: outcome.is_successful ?? (outcome.outcome_type === 'hired'),
          salary_band: outcome.salary_band,
          skills_snapshot: skills || [],
          verified_skills_count: skills?.length || 0,
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return { error: insertError.message };
      }

      // Update local state
      if (data) {
        setOutcomes(prev => [data, ...prev]);
      }

      return { data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return { error: message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Fetch all outcomes for the current user
   */
  const fetchOutcomes = useCallback(async (): Promise<{
    data: PlacementOutcome[];
    error?: string;
  }> => {
    if (!user) {
      return { data: [], error: 'Not authenticated' };
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('placement_outcomes')
        .select('*')
        .eq('user_id', user.id)
        .order('outcome_date', { ascending: false, nullsFirst: false });

      if (fetchError) {
        setError(fetchError.message);
        return { data: [], error: fetchError.message };
      }

      setOutcomes(data || []);
      return { data: data || [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return { data: [], error: message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Update an existing outcome
   */
  const updateOutcome = useCallback(async (
    id: string,
    updates: Partial<NewOutcome>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('placement_outcomes')
        .update({
          ...updates,
          is_successful: updates.is_successful ?? (updates.outcome_type === 'hired'),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) {
        setError(updateError.message);
        return { success: false, error: updateError.message };
      }

      // Update local state
      setOutcomes(prev =>
        prev.map(o => o.id === id ? { ...o, ...updates } : o)
      );

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Delete an outcome
   */
  const deleteOutcome = useCallback(async (id: string): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { error: deleteError } = await supabase
        .from('placement_outcomes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      setOutcomes(prev => prev.filter(o => o.id !== id));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }, [user]);

  /**
   * Get outcome statistics
   */
  const getStats = useCallback(() => {
    const total = outcomes.length;
    const successful = outcomes.filter(o => o.is_successful).length;
    const interviews = outcomes.filter(o => o.outcome_type === 'interview').length;
    const hired = outcomes.filter(o => o.outcome_type === 'hired').length;
    const rejected = outcomes.filter(o => o.outcome_type === 'rejected').length;

    return {
      total,
      successful,
      interviews,
      hired,
      rejected,
      success_rate: total > 0 ? (successful / total) * 100 : 0,
      interview_to_hire: interviews > 0 ? (hired / interviews) * 100 : 0,
    };
  }, [outcomes]);

  return {
    outcomes,
    loading,
    error,
    recordOutcome,
    fetchOutcomes,
    updateOutcome,
    deleteOutcome,
    getStats,
  };
}

export default usePlacementOutcomes;
