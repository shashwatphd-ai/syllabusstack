import { useRef, useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WatchedSegment {
  start: number;
  end: number;
}

export interface ConsumptionEvent {
  type: 'play' | 'pause' | 'seek' | 'speed_change' | 'tab_focus_loss' | 'complete';
  timestamp: number;
  video_time: number;
  data?: any;
}

interface MicroCheckResult {
  id: string;
  is_correct: boolean;
  attempt_number: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'retrying';

interface PendingSync {
  body: any;
  retries: number;
  timestamp: number;
}

// Max retries and delays for exponential backoff
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // 2s, 4s, 8s

// Original hook with options object
interface UseConsumptionTrackingOptions {
  contentId: string;
  learningObjectiveId?: string;
  totalDuration: number;
  onVerified?: () => void;
}

export function useConsumptionTracking(options: UseConsumptionTrackingOptions): {
  watchPercentage: number;
  engagementScore: number | null;
  isVerified: boolean;
  isTracking: boolean;
  syncStatus: SyncStatus;
  pendingSyncs: number;
  handlers: {
    onPlay: (currentTime: number) => void;
    onPause: (currentTime: number) => void;
    onSeek: (fromTime: number, toTime: number) => void;
    onSpeedChange: (speed: number, currentTime: number) => void;
    onTabFocusLoss: (currentTime: number) => void;
    onComplete: (currentTime: number) => void;
    onTimeUpdate: (currentTime: number) => void;
  };
  syncConsumption: (segments: WatchedSegment[], duration: number, microCheckResults: MicroCheckResult[]) => void;
  trackEvent: (event: ConsumptionEvent) => void;
  retryPendingSyncs: () => void;
};

// Overload for simple two-argument call used in VerifiedVideoPlayer
export function useConsumptionTracking(contentId: string, learningObjectiveId?: string): {
  watchPercentage: number;
  engagementScore: number | null;
  isVerified: boolean;
  isTracking: boolean;
  syncStatus: SyncStatus;
  pendingSyncs: number;
  handlers: {
    onPlay: (currentTime: number) => void;
    onPause: (currentTime: number) => void;
    onSeek: (fromTime: number, toTime: number) => void;
    onSpeedChange: (speed: number, currentTime: number) => void;
    onTabFocusLoss: (currentTime: number) => void;
    onComplete: (currentTime: number) => void;
    onTimeUpdate: (currentTime: number) => void;
  };
  syncConsumption: (segments: WatchedSegment[], duration: number, microCheckResults: MicroCheckResult[]) => void;
  trackEvent: (event: ConsumptionEvent) => void;
  retryPendingSyncs: () => void;
};

export function useConsumptionTracking(
  optionsOrContentId: UseConsumptionTrackingOptions | string,
  learningObjectiveIdArg?: string
) {
  // Normalize arguments
  const isOptionsObject = typeof optionsOrContentId === 'object';
  const contentId = isOptionsObject ? optionsOrContentId.contentId : optionsOrContentId;
  const learningObjectiveId = isOptionsObject ? optionsOrContentId.learningObjectiveId : learningObjectiveIdArg;
  const totalDuration = isOptionsObject ? optionsOrContentId.totalDuration : 0;
  const onVerified = isOptionsObject ? optionsOrContentId.onVerified : undefined;

  const [watchPercentage, setWatchPercentage] = useState(0);
  const [engagementScore, setEngagementScore] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingSyncsQueue, setPendingSyncsQueue] = useState<PendingSync[]>([]);

  const segmentsRef = useRef<WatchedSegment[]>([]);
  const currentSegmentStartRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Retry pending syncs when queue changes (with proper cleanup)
  useEffect(() => {
    if (pendingSyncsQueue.length > 0 && syncStatus !== 'syncing' && syncStatus !== 'retrying') {
      const oldestPending = pendingSyncsQueue[0];
      if (oldestPending.retries < MAX_RETRIES) {
        const delay = RETRY_DELAYS[oldestPending.retries] || 8000;
        setSyncStatus('retrying');

        // Create new abort controller for this retry cycle
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        retryTimeoutRef.current = setTimeout(() => {
          // Check if aborted before executing async work
          if (!signal.aborted) {
            retrySync(oldestPending);
          }
        }, delay);
      }
    }

    return () => {
      // Cleanup: clear timeout and abort any pending async work
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [pendingSyncsQueue, syncStatus]);

  const retrySync = async (pending: PendingSync) => {
    try {
      const { data, error } = await supabase.functions.invoke('track-consumption', {
        body: pending.body,
      });

      if (error) {
        console.error('Retry sync failed:', error);
        // Increment retry count or remove if max retries reached
        // Fix: derive status from the updated queue, not stale closure
        setPendingSyncsQueue(prev => {
          const updated = prev.map(p =>
            p.timestamp === pending.timestamp
              ? { ...p, retries: p.retries + 1 }
              : p
          );
          // Remove items that exceeded max retries
          const filtered = updated.filter(p => p.retries < MAX_RETRIES);
          // Set status based on NEW queue length (avoids stale closure)
          setTimeout(() => setSyncStatus(filtered.length > 0 ? 'retrying' : 'error'), 0);
          return filtered;
        });
        return;
      }

      // Success - remove from queue and update status
      setPendingSyncsQueue(prev => {
        const remaining = prev.filter(p => p.timestamp !== pending.timestamp);
        // Set status based on NEW queue length (avoids stale closure)
        setTimeout(() => setSyncStatus(remaining.length > 0 ? 'retrying' : 'success'), 0);
        return remaining;
      });

      if (data?.consumption_record) {
        setWatchPercentage(data.consumption_record.watch_percentage || 0);
        setEngagementScore(data.consumption_record.engagement_score);

        if (data.consumption_record.is_verified && !isVerified) {
          setIsVerified(true);
          onVerified?.();
        }
      }
      // Reset status after a short delay
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      console.error('Retry sync exception:', err);
      setPendingSyncsQueue(prev => {
        const updated = prev.map(p =>
          p.timestamp === pending.timestamp
            ? { ...p, retries: p.retries + 1 }
            : p
        );
        return updated.filter(p => p.retries < MAX_RETRIES);
      });
      setSyncStatus('error');
    }
  };

  const retryPendingSyncs = useCallback(() => {
    // Reset retry counts and trigger retry
    setPendingSyncsQueue(prev => prev.map(p => ({ ...p, retries: 0 })));
  }, []);

  const syncWithServer = useCallback(async (event?: ConsumptionEvent) => {
    const requestBody = {
      content_id: contentId,
      learning_objective_id: learningObjectiveId,
      event,
      current_segments: segmentsRef.current,
      total_duration: totalDuration,
    };

    setSyncStatus('syncing');

    try {
      const { data, error } = await supabase.functions.invoke('track-consumption', {
        body: requestBody,
      });

      if (error) {
        console.error('Error syncing consumption:', error);
        // Add to retry queue
        setPendingSyncsQueue(prev => [...prev, {
          body: requestBody,
          retries: 0,
          timestamp: Date.now(),
        }]);
        setSyncStatus('error');
        return;
      }

      if (data?.consumption_record) {
        setWatchPercentage(data.consumption_record.watch_percentage || 0);
        setEngagementScore(data.consumption_record.engagement_score);

        if (data.consumption_record.is_verified && !isVerified) {
          setIsVerified(true);
          onVerified?.();
        }
      }

      lastSyncTimeRef.current = Date.now();
      setSyncStatus('success');
      // Reset status after a short delay
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      console.error('Error in syncWithServer:', err);
      // Add to retry queue
      setPendingSyncsQueue(prev => [...prev, {
        body: requestBody,
        retries: 0,
        timestamp: Date.now(),
      }]);
      setSyncStatus('error');
    }
  }, [contentId, learningObjectiveId, totalDuration, isVerified, onVerified]);

  // Explicit sync function for VerifiedVideoPlayer
  const syncConsumption = useCallback(async (
    segments: WatchedSegment[],
    duration: number,
    microCheckResults: MicroCheckResult[]
  ) => {
    const requestBody = {
      content_id: contentId,
      learning_objective_id: learningObjectiveId,
      current_segments: segments,
      total_duration: duration,
      micro_check_results: microCheckResults,
    };

    setSyncStatus('syncing');

    try {
      const { data, error } = await supabase.functions.invoke('track-consumption', {
        body: requestBody,
      });

      if (error) {
        console.error('Error syncing consumption:', error);
        // Add to retry queue
        setPendingSyncsQueue(prev => [...prev, {
          body: requestBody,
          retries: 0,
          timestamp: Date.now(),
        }]);
        setSyncStatus('error');
        return;
      }

      if (data?.consumption_record) {
        setWatchPercentage(data.consumption_record.watch_percentage || 0);
        setEngagementScore(data.consumption_record.engagement_score);

        if (data.consumption_record.is_verified && !isVerified) {
          setIsVerified(true);
          onVerified?.();
        }
      }

      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      console.error('Error in syncConsumption:', err);
      // Add to retry queue
      setPendingSyncsQueue(prev => [...prev, {
        body: requestBody,
        retries: 0,
        timestamp: Date.now(),
      }]);
      setSyncStatus('error');
    }
  }, [contentId, learningObjectiveId, isVerified, onVerified]);

  // Explicit event tracking
  const trackEvent = useCallback((event: ConsumptionEvent) => {
    syncWithServer(event);
  }, [syncWithServer]);

  const handlePlay = useCallback((currentTime: number) => {
    setIsTracking(true);
    currentSegmentStartRef.current = currentTime;

    syncWithServer({
      type: 'play',
      timestamp: Date.now(),
      video_time: currentTime,
    });
  }, [syncWithServer]);

  const handlePause = useCallback((currentTime: number) => {
    if (currentSegmentStartRef.current !== null) {
      segmentsRef.current.push({
        start: currentSegmentStartRef.current,
        end: currentTime,
      });
      currentSegmentStartRef.current = null;
    }

    syncWithServer({
      type: 'pause',
      timestamp: Date.now(),
      video_time: currentTime,
    });
  }, [syncWithServer]);

  const handleSeek = useCallback((fromTime: number, toTime: number) => {
    // Close current segment before seeking
    if (currentSegmentStartRef.current !== null) {
      segmentsRef.current.push({
        start: currentSegmentStartRef.current,
        end: fromTime,
      });
      currentSegmentStartRef.current = toTime;
    }

    syncWithServer({
      type: 'seek',
      timestamp: Date.now(),
      video_time: toTime,
      data: { from: fromTime, to: toTime },
    });
  }, [syncWithServer]);

  const handleSpeedChange = useCallback((speed: number, currentTime: number) => {
    syncWithServer({
      type: 'speed_change',
      timestamp: Date.now(),
      video_time: currentTime,
      data: { speed },
    });
  }, [syncWithServer]);

  const handleTabFocusLoss = useCallback((currentTime: number) => {
    syncWithServer({
      type: 'tab_focus_loss',
      timestamp: Date.now(),
      video_time: currentTime,
    });
  }, [syncWithServer]);

  const handleComplete = useCallback((currentTime: number) => {
    // Close any open segment
    if (currentSegmentStartRef.current !== null) {
      segmentsRef.current.push({
        start: currentSegmentStartRef.current,
        end: currentTime,
      });
      currentSegmentStartRef.current = null;
    }

    setIsTracking(false);

    syncWithServer({
      type: 'complete',
      timestamp: Date.now(),
      video_time: currentTime,
    });
  }, [syncWithServer]);

  const handleTimeUpdate = useCallback((currentTime: number) => {
    // Sync every 30 seconds during playback
    if (Date.now() - lastSyncTimeRef.current > 30000) {
      // Close and reopen segment to capture progress
      if (currentSegmentStartRef.current !== null) {
        segmentsRef.current.push({
          start: currentSegmentStartRef.current,
          end: currentTime,
        });
        currentSegmentStartRef.current = currentTime;
      }
      syncWithServer();
    }
  }, [syncWithServer]);

  return {
    watchPercentage,
    engagementScore,
    isVerified,
    isTracking,
    syncStatus,
    pendingSyncs: pendingSyncsQueue.length,
    handlers: {
      onPlay: handlePlay,
      onPause: handlePause,
      onSeek: handleSeek,
      onSpeedChange: handleSpeedChange,
      onTabFocusLoss: handleTabFocusLoss,
      onComplete: handleComplete,
      onTimeUpdate: handleTimeUpdate,
    },
    syncConsumption,
    trackEvent,
    retryPendingSyncs,
  };
}