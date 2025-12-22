import { useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WatchedSegment {
  start: number;
  end: number;
}

interface ConsumptionEvent {
  type: 'play' | 'pause' | 'seek' | 'speed_change' | 'tab_focus_loss' | 'complete';
  timestamp: number;
  video_time: number;
  data?: any;
}

interface UseConsumptionTrackingOptions {
  contentId: string;
  learningObjectiveId?: string;
  totalDuration: number;
  onVerified?: () => void;
}

export function useConsumptionTracking({
  contentId,
  learningObjectiveId,
  totalDuration,
  onVerified,
}: UseConsumptionTrackingOptions) {
  const [watchPercentage, setWatchPercentage] = useState(0);
  const [engagementScore, setEngagementScore] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  const segmentsRef = useRef<WatchedSegment[]>([]);
  const currentSegmentStartRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  const syncWithServer = useCallback(async (event?: ConsumptionEvent) => {
    try {
      const { data, error } = await supabase.functions.invoke('track-consumption', {
        body: {
          content_id: contentId,
          learning_objective_id: learningObjectiveId,
          event,
          current_segments: segmentsRef.current,
          total_duration: totalDuration,
        },
      });

      if (error) {
        console.error('Error syncing consumption:', error);
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
    } catch (err) {
      console.error('Error in syncWithServer:', err);
    }
  }, [contentId, learningObjectiveId, totalDuration, isVerified, onVerified]);

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
    handlers: {
      onPlay: handlePlay,
      onPause: handlePause,
      onSeek: handleSeek,
      onSpeedChange: handleSpeedChange,
      onTabFocusLoss: handleTabFocusLoss,
      onComplete: handleComplete,
      onTimeUpdate: handleTimeUpdate,
    },
  };
}
