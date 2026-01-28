/**
 * useAssessmentAutoSave.ts
 *
 * PURPOSE: Persist assessment progress to localStorage
 *
 * WHY THIS EXISTS (Task 3.1 from MASTER_IMPLEMENTATION_PLAN_V2.md):
 * - Connection loss or accidental page close can cause lost progress
 * - Students may lose 10-15 minutes of work during assessments
 * - Provides recovery dialog when returning to an interrupted assessment
 *
 * HOW IT WORKS:
 * 1. Saves after each answer to localStorage
 * 2. Provides recovery check on mount
 * 3. Clears on assessment completion
 *
 * USAGE:
 * ```tsx
 * const { getSavedProgress, saveProgress, clearProgress } = useAssessmentAutoSave(learningObjectiveId);
 *
 * // Check for saved progress on mount
 * useEffect(() => {
 *   const saved = getSavedProgress();
 *   if (saved) setShowRecoveryDialog(true);
 * }, []);
 *
 * // Auto-save after each answer
 * useEffect(() => {
 *   if (sessionId) saveProgress({ sessionId, questions, ... });
 * }, [progress]);
 *
 * // Clear on completion
 * clearProgress();
 * ```
 */
import { useCallback } from 'react';
import type { AssessmentQuestion, SessionProgress } from './useAssessment';

export interface SavedAssessmentState {
  sessionId: string;
  learningObjectiveId: string;
  questions: AssessmentQuestion[];
  currentQuestionIndex: number;
  progress: SessionProgress;
  answeredQuestions: Record<string, boolean>; // Map serialized as object
  savedAt: string;
}

const STORAGE_KEY = 'syllabusstack_assessment_progress';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useAssessmentAutoSave(learningObjectiveId: string) {
  /**
   * Check for saved progress on mount
   * Returns saved state if:
   * - Same learning objective
   * - Not expired (< 24 hours old)
   * - Valid JSON
   */
  const getSavedProgress = useCallback((): SavedAssessmentState | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const parsed: SavedAssessmentState = JSON.parse(saved);

      // Check if same learning objective
      if (parsed.learningObjectiveId !== learningObjectiveId) {
        return null;
      }

      // Check if not expired
      const savedTime = new Date(parsed.savedAt).getTime();
      if (Date.now() - savedTime > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      // Validate required fields exist
      if (!parsed.sessionId || !parsed.questions || !parsed.progress) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch {
      // Invalid JSON or other error - clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }, [learningObjectiveId]);

  /**
   * Save current progress to localStorage
   * Called after each answer is submitted
   */
  const saveProgress = useCallback(
    (state: Omit<SavedAssessmentState, 'savedAt' | 'learningObjectiveId'>) => {
      try {
        const toSave: SavedAssessmentState = {
          ...state,
          learningObjectiveId,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (error) {
        // localStorage might be full or disabled - log but don't crash
        console.warn('Failed to save assessment progress:', error);
      }
    },
    [learningObjectiveId]
  );

  /**
   * Clear saved progress
   * Called on successful assessment completion
   */
  const clearProgress = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore errors when clearing
    }
  }, []);

  /**
   * Check if there's any saved assessment (regardless of learning objective)
   * Useful for showing a general "you have unsaved progress" indicator
   */
  const hasAnySavedProgress = useCallback((): boolean => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return false;

      const parsed = JSON.parse(saved);
      const savedTime = new Date(parsed.savedAt).getTime();
      return Date.now() - savedTime <= MAX_AGE_MS;
    } catch {
      return false;
    }
  }, []);

  return {
    getSavedProgress,
    saveProgress,
    clearProgress,
    hasAnySavedProgress,
  };
}
