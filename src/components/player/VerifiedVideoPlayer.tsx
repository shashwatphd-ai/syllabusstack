import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useConsumptionTracking, ConsumptionEvent } from '@/hooks/useConsumptionTracking';
import { MicroCheckOverlay } from './MicroCheckOverlay';

interface WatchedSegment {
  start: number;
  end: number;
}

interface MicroCheck {
  id: string;
  trigger_time_seconds: number;
  question_text: string;
  question_type: 'recall' | 'mcq';
  options?: { text: string; is_correct?: boolean }[];
  correct_answer: string;
  rewind_target_seconds?: number;
}

interface VerifiedVideoPlayerProps {
  contentId: string;
  learningObjectiveId: string;
  videoUrl: string;
  title: string;
  duration: number;
  microChecks?: MicroCheck[];
  onComplete?: (engagementScore: number, isVerified: boolean) => void;
}

type PlayerState = 'LOADING' | 'READY' | 'PLAYING' | 'PAUSED' | 'MICROCHECK_ACTIVE' | 'MICROCHECK_FAILED' | 'COMPLETED' | 'BLOCKED';

export function VerifiedVideoPlayer({
  contentId,
  learningObjectiveId,
  videoUrl,
  title,
  duration,
  microChecks = [],
  onComplete,
}: VerifiedVideoPlayerProps) {
  const playerRef = useRef<HTMLIFrameElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('LOADING');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [watchedSegments, setWatchedSegments] = useState<WatchedSegment[]>([]);
  const [currentSegmentStart, setCurrentSegmentStart] = useState<number | null>(null);
  const [activeMicroCheck, setActiveMicroCheck] = useState<MicroCheck | null>(null);
  const [completedMicroChecks, setCompletedMicroChecks] = useState<Set<string>>(new Set());
  const [microCheckResults, setMicroCheckResults] = useState<Array<{ id: string; is_correct: boolean; attempt_number: number }>>([]);
  const [speedViolation, setSpeedViolation] = useState(false);

  const { syncConsumption, trackEvent, isVerified, engagementScore } = useConsumptionTracking(
    contentId,
    learningObjectiveId
  );

  // Calculate watch percentage
  const watchPercentage = useCallback(() => {
    if (duration === 0) return 0;
    const merged = mergeSegments(watchedSegments);
    const watchedSeconds = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    return Math.min((watchedSeconds / duration) * 100, 100);
  }, [watchedSegments, duration]);

  // Merge overlapping segments
  function mergeSegments(segments: WatchedSegment[]): WatchedSegment[] {
    if (segments.length === 0) return [];
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const merged: WatchedSegment[] = [{ ...sorted[0] }];
    
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];
      if (current.start <= last.end + 1) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push({ ...current });
      }
    }
    return merged;
  }

  // Handle play
  const handlePlay = () => {
    if (playerState === 'BLOCKED') return;
    setIsPlaying(true);
    setPlayerState('PLAYING');
    setCurrentSegmentStart(currentTime);
    trackEvent({ type: 'play', timestamp: Date.now(), video_time: currentTime });
  };

  // Handle pause
  const handlePause = () => {
    setIsPlaying(false);
    setPlayerState('PAUSED');
    
    // Save current segment
    if (currentSegmentStart !== null) {
      const newSegment = { start: currentSegmentStart, end: currentTime };
      setWatchedSegments(prev => [...prev, newSegment]);
      setCurrentSegmentStart(null);
    }
    
    trackEvent({ type: 'pause', timestamp: Date.now(), video_time: currentTime });
  };

  // Handle seek
  const handleSeek = (newTime: number) => {
    const oldTime = currentTime;
    
    // Save current segment before seeking
    if (currentSegmentStart !== null && isPlaying) {
      const newSegment = { start: currentSegmentStart, end: oldTime };
      setWatchedSegments(prev => [...prev, newSegment]);
    }
    
    setCurrentTime(newTime);
    if (isPlaying) {
      setCurrentSegmentStart(newTime);
    }
    
    // Track rewind
    if (newTime < oldTime) {
      trackEvent({ 
        type: 'seek', 
        timestamp: Date.now(), 
        video_time: newTime,
        data: { from: oldTime, to: newTime },
      });
    }
  };

  // Handle speed change
  const handleSpeedChange = (speed: number) => {
    if (speed > 2) {
      setSpeedViolation(true);
      setPlayerState('BLOCKED');
      trackEvent({ type: 'speed_change', timestamp: Date.now(), video_time: currentTime, data: { speed } });
    }
  };

  // Handle tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlaying) {
        trackEvent({ type: 'tab_focus_loss', timestamp: Date.now(), video_time: currentTime });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying, currentTime, trackEvent]);

  // Check for micro-checks
  useEffect(() => {
    if (playerState !== 'PLAYING') return;
    
    const pendingCheck = microChecks.find(
      mc => !completedMicroChecks.has(mc.id) && 
            currentTime >= mc.trigger_time_seconds && 
            currentTime < mc.trigger_time_seconds + 2
    );
    
    if (pendingCheck) {
      setActiveMicroCheck(pendingCheck);
      setPlayerState('MICROCHECK_ACTIVE');
      handlePause();
    }
  }, [currentTime, playerState, microChecks, completedMicroChecks]);

  // Handle micro-check answer
  const handleMicroCheckAnswer = (isCorrect: boolean) => {
    if (!activeMicroCheck) return;
    
    const attemptNumber = microCheckResults.filter(r => r.id === activeMicroCheck.id).length + 1;
    setMicroCheckResults(prev => [...prev, { id: activeMicroCheck.id, is_correct: isCorrect, attempt_number: attemptNumber }]);
    
    if (isCorrect) {
      setCompletedMicroChecks(prev => new Set([...prev, activeMicroCheck.id]));
      setActiveMicroCheck(null);
      setPlayerState('READY');
    } else {
      setPlayerState('MICROCHECK_FAILED');
      // Rewind after a moment
      setTimeout(() => {
        const rewindTo = activeMicroCheck.rewind_target_seconds ?? Math.max(0, activeMicroCheck.trigger_time_seconds - 30);
        handleSeek(rewindTo);
        setActiveMicroCheck(null);
        setPlayerState('READY');
      }, 2000);
    }
  };

  // Handle completion
  const handleComplete = () => {
    if (currentSegmentStart !== null) {
      setWatchedSegments(prev => [...prev, { start: currentSegmentStart, end: currentTime }]);
    }
    
    setPlayerState('COMPLETED');
    trackEvent({ type: 'complete', timestamp: Date.now(), video_time: currentTime });
    
    // Sync final state
    syncConsumption(watchedSegments, duration, microCheckResults);
    
    if (onComplete) {
      onComplete(engagementScore || 0, isVerified || false);
    }
  };

  // Simulate time progression (in real implementation, would listen to YouTube API events)
  useEffect(() => {
    if (!isPlaying || playerState !== 'PLAYING') return;
    
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;
        if (newTime >= duration) {
          handleComplete();
          return duration;
        }
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPlaying, playerState, duration]);

  // Sync periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (watchedSegments.length > 0) {
        syncConsumption(watchedSegments, duration, microCheckResults);
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [watchedSegments, duration, microCheckResults, syncConsumption]);

  // Extract video ID from URL
  const getVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? match[1] : '';
  };

  const videoId = getVideoId(videoUrl);
  const progress = (currentTime / duration) * 100;

  return (
    <Card className="overflow-hidden">
      {/* Video Container */}
      <div className="relative aspect-video bg-black">
        {playerState === 'BLOCKED' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold text-destructive">Playback Blocked</h3>
            <p className="text-sm text-muted-foreground mt-2">Speed violations detected. Please refresh to continue.</p>
          </div>
        ) : (
          <>
            <iframe
              ref={playerRef}
              src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&modestbranding=1&rel=0`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            
            {/* Micro-check Overlay */}
            {activeMicroCheck && (
              <MicroCheckOverlay
                microCheck={activeMicroCheck}
                onAnswer={handleMicroCheckAnswer}
                isFailed={playerState === 'MICROCHECK_FAILED'}
              />
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Title and Status */}
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-semibold text-foreground line-clamp-1">{title}</h3>
          <div className="flex items-center gap-2">
            {isVerified && (
              <Badge className="bg-success/10 text-success">Verified</Badge>
            )}
            {engagementScore !== null && (
              <Badge variant="outline">
                Score: {Math.round(engagementScore)}%
              </Badge>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="relative">
            <Progress value={progress} className="h-2" />
            {/* Micro-check markers */}
            {microChecks.map(mc => (
              <div
                key={mc.id}
                className={`absolute top-0 w-1 h-2 rounded ${
                  completedMicroChecks.has(mc.id) ? 'bg-success' : 'bg-warning'
                }`}
                style={{ left: `${(mc.trigger_time_seconds / duration) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={isPlaying ? handlePause : handlePlay}
              disabled={playerState === 'BLOCKED' || playerState === 'MICROCHECK_ACTIVE'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSeek(Math.max(0, currentTime - 10))}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>

          {/* Watch Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Watched: {Math.round(watchPercentage())}%</span>
            <span>Checks: {completedMicroChecks.size}/{microChecks.length}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
