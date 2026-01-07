import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useConsumptionTracking } from '@/hooks/useConsumptionTracking';
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

// Global flag to track if YouTube API is loading
let isYouTubeApiLoading = false;
let isYouTubeApiReady = false;
const apiReadyCallbacks: (() => void)[] = [];

// Load YouTube IFrame API
function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (isYouTubeApiReady) {
      resolve();
      return;
    }

    apiReadyCallbacks.push(resolve);

    if (isYouTubeApiLoading) {
      return;
    }

    isYouTubeApiLoading = true;

    // Set up the callback that YouTube API will call when ready
    window.onYouTubeIframeAPIReady = () => {
      isYouTubeApiReady = true;
      apiReadyCallbacks.forEach(cb => cb());
      apiReadyCallbacks.length = 0;
    };

    // Load the API script
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });
}

export function VerifiedVideoPlayer({
  contentId,
  learningObjectiveId,
  videoUrl,
  title,
  duration,
  microChecks = [],
  onComplete,
}: VerifiedVideoPlayerProps) {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<YT.Player | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  
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
  const [videoDuration, setVideoDuration] = useState(duration);

  const { 
    syncConsumption, 
    trackEvent, 
    isVerified, 
    engagementScore 
  } = useConsumptionTracking(contentId, learningObjectiveId);

  // Extract video ID from URL
  const getVideoId = useCallback((url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
    return match ? match[1] : '';
  }, []);

  const videoId = getVideoId(videoUrl);

  // Calculate watch percentage
  const watchPercentage = useCallback(() => {
    const effectiveDuration = videoDuration || duration;
    if (effectiveDuration === 0) return 0;
    const merged = mergeSegments(watchedSegments);
    const watchedSeconds = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    return Math.min((watchedSeconds / effectiveDuration) * 100, 100);
  }, [watchedSegments, videoDuration, duration]);

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

  // Start time tracking interval
  const startTimeTracking = useCallback(() => {
    if (timeUpdateIntervalRef.current) return;
    
    timeUpdateIntervalRef.current = window.setInterval(() => {
      if (playerInstanceRef.current) {
        const time = playerInstanceRef.current.getCurrentTime();
        setCurrentTime(time);
      }
    }, 250); // Update 4 times per second for smooth progress
  }, []);

  // Stop time tracking interval
  const stopTimeTracking = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      window.clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
  }, []);

  // Initialize YouTube player
  useEffect(() => {
    if (!videoId) return;

    let isMounted = true;
    
    const initPlayer = async () => {
      await loadYouTubeApi();
      
      if (!isMounted || !playerContainerRef.current) return;

      // Create a unique container ID
      const containerId = `yt-player-${contentId}`;
      playerContainerRef.current.id = containerId;

      playerInstanceRef.current = new YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (!isMounted) return;
            setPlayerState('READY');
            // Get actual video duration from YouTube
            const ytDuration = event.target.getDuration();
            if (ytDuration > 0) {
              setVideoDuration(ytDuration);
            }
          },
          onStateChange: (event) => {
            if (!isMounted) return;
            handleYouTubeStateChange(event.data);
          },
          onPlaybackRateChange: (event) => {
            if (!isMounted) return;
            handlePlaybackRateChange(event.data);
          },
          onError: (event) => {
            console.error('YouTube player error:', event.data);
          },
        },
      });
    };

    initPlayer();

    return () => {
      isMounted = false;
      stopTimeTracking();
      if (playerInstanceRef.current) {
        playerInstanceRef.current.destroy();
        playerInstanceRef.current = null;
      }
    };
  }, [videoId, contentId]);

  // Handle YouTube state changes
  const handleYouTubeStateChange = useCallback((state: number) => {
    const time = playerInstanceRef.current?.getCurrentTime() || 0;
    
    switch (state) {
      case YT.PlayerState.PLAYING:
        if (playerState === 'MICROCHECK_ACTIVE' || playerState === 'MICROCHECK_FAILED') {
          // Don't allow playing during micro-check
          playerInstanceRef.current?.pauseVideo();
          return;
        }
        setIsPlaying(true);
        setPlayerState('PLAYING');
        setCurrentSegmentStart(time);
        startTimeTracking();
        trackEvent({ type: 'play', timestamp: Date.now(), video_time: time });
        break;
        
      case YT.PlayerState.PAUSED:
        setIsPlaying(false);
        if (playerState !== 'MICROCHECK_ACTIVE' && playerState !== 'MICROCHECK_FAILED') {
          setPlayerState('PAUSED');
        }
        stopTimeTracking();
        
        // Save current segment
        if (currentSegmentStart !== null) {
          const newSegment = { start: currentSegmentStart, end: time };
          setWatchedSegments(prev => [...prev, newSegment]);
          setCurrentSegmentStart(null);
        }
        
        trackEvent({ type: 'pause', timestamp: Date.now(), video_time: time });
        break;
        
      case YT.PlayerState.ENDED:
        stopTimeTracking();
        handleVideoComplete();
        break;
        
      case YT.PlayerState.BUFFERING:
        // Keep tracking but note buffering
        break;
    }
  }, [playerState, currentSegmentStart, startTimeTracking, stopTimeTracking, trackEvent]);

  // Handle playback rate changes
  const handlePlaybackRateChange = useCallback((rate: number) => {
    const time = playerInstanceRef.current?.getCurrentTime() || 0;
    
    if (rate > 2) {
      setSpeedViolation(true);
      setPlayerState('BLOCKED');
      playerInstanceRef.current?.pauseVideo();
      stopTimeTracking();
      trackEvent({ type: 'speed_change', timestamp: Date.now(), video_time: time, data: { speed: rate } });
    }
  }, [stopTimeTracking, trackEvent]);

  // Handle video completion
  const handleVideoComplete = useCallback(() => {
    const time = playerInstanceRef.current?.getCurrentTime() || videoDuration;
    
    if (currentSegmentStart !== null) {
      setWatchedSegments(prev => [...prev, { start: currentSegmentStart, end: time }]);
      setCurrentSegmentStart(null);
    }
    
    setPlayerState('COMPLETED');
    setIsPlaying(false);
    trackEvent({ type: 'complete', timestamp: Date.now(), video_time: time });
    
    // Sync final state
    syncConsumption(watchedSegments, videoDuration, microCheckResults);
    
    if (onComplete) {
      onComplete(engagementScore || 0, isVerified || false);
    }
  }, [currentSegmentStart, videoDuration, watchedSegments, microCheckResults, engagementScore, isVerified, onComplete, syncConsumption, trackEvent]);

  // Player control functions
  const handlePlay = useCallback(() => {
    if (playerState === 'BLOCKED' || !playerInstanceRef.current) return;
    playerInstanceRef.current.playVideo();
  }, [playerState]);

  const handlePause = useCallback(() => {
    if (!playerInstanceRef.current) return;
    playerInstanceRef.current.pauseVideo();
  }, []);

  const handleSeek = useCallback((newTime: number) => {
    if (!playerInstanceRef.current) return;
    
    const oldTime = playerInstanceRef.current.getCurrentTime();
    
    // Save current segment before seeking
    if (currentSegmentStart !== null && isPlaying) {
      const newSegment = { start: currentSegmentStart, end: oldTime };
      setWatchedSegments(prev => [...prev, newSegment]);
      setCurrentSegmentStart(newTime);
    }
    
    playerInstanceRef.current.seekTo(newTime, true);
    setCurrentTime(newTime);
    
    // Track rewind
    if (newTime < oldTime) {
      trackEvent({ 
        type: 'seek', 
        timestamp: Date.now(), 
        video_time: newTime,
        data: { from: oldTime, to: newTime },
      });
    }
  }, [currentSegmentStart, isPlaying, trackEvent]);

  const handleMuteToggle = useCallback(() => {
    if (!playerInstanceRef.current) return;
    
    if (isMuted) {
      playerInstanceRef.current.unMute();
    } else {
      playerInstanceRef.current.mute();
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlaying) {
        const time = playerInstanceRef.current?.getCurrentTime() || currentTime;
        trackEvent({ type: 'tab_focus_loss', timestamp: Date.now(), video_time: time });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying, currentTime, trackEvent]);

  // Check for micro-checks based on current time
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
      playerInstanceRef.current?.pauseVideo();
    }
  }, [currentTime, playerState, microChecks, completedMicroChecks]);

  // Handle micro-check answer
  const handleMicroCheckAnswer = useCallback((isCorrect: boolean) => {
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
  }, [activeMicroCheck, microCheckResults, handleSeek]);

  // Sync periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (watchedSegments.length > 0) {
        syncConsumption(watchedSegments, videoDuration, microCheckResults);
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [watchedSegments, videoDuration, microCheckResults, syncConsumption]);

  const effectiveDuration = videoDuration || duration;
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

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
            {playerState === 'LOADING' && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {/* YouTube Player Container */}
            <div 
              ref={playerContainerRef} 
              className="w-full h-full"
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
                style={{ left: `${(mc.trigger_time_seconds / effectiveDuration) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(effectiveDuration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={isPlaying ? handlePause : handlePlay}
              disabled={playerState === 'BLOCKED' || playerState === 'MICROCHECK_ACTIVE' || playerState === 'LOADING'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSeek(Math.max(0, currentTime - 10))}
              disabled={playerState === 'LOADING'}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMuteToggle}
              disabled={playerState === 'LOADING'}
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
