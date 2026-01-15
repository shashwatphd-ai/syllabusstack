import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Audio segment mapping for synchronized highlighting
 */
export interface AudioSegment {
  target_block: string;
  start_percent: number;
  end_percent: number;
  narration_excerpt?: string;
}

interface UseSlideSyncOptions {
  audioDuration: number;
  segmentMap: AudioSegment[];
  enabled?: boolean;
}

interface UseSlideSyncResult {
  activeBlockId: string | null;
  currentPercent: number;
  isBlockActive: (blockId: string) => boolean;
  setAudioRef: (audio: HTMLAudioElement | null) => void;
}

/**
 * Hook for synchronizing slide content highlighting with audio playback
 * Uses the AI-generated segment map to determine which content block is active
 */
export function useSlideSync({
  audioDuration,
  segmentMap,
  enabled = true,
}: UseSlideSyncOptions): UseSlideSyncResult {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [currentPercent, setCurrentPercent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Update active block based on current audio position
  const updateActiveBlock = useCallback(() => {
    if (!audioRef.current || !enabled || segmentMap.length === 0) {
      return;
    }

    const currentTime = audioRef.current.currentTime;
    const percent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;
    setCurrentPercent(percent);

    // Find the active segment
    const activeSegment = segmentMap.find(
      s => percent >= s.start_percent && percent < s.end_percent
    );

    // Special case for last segment (use end_percent inclusively)
    if (!activeSegment && percent >= 99) {
      const lastSegment = segmentMap[segmentMap.length - 1];
      setActiveBlockId(lastSegment?.target_block || null);
      return;
    }

    setActiveBlockId(activeSegment?.target_block || null);
  }, [audioDuration, segmentMap, enabled]);

  // Set up audio ref and interval
  const setAudioRef = useCallback((audio: HTMLAudioElement | null) => {
    audioRef.current = audio;

    // Clean up existing interval
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!audio || !enabled) {
      setActiveBlockId(null);
      setCurrentPercent(0);
      return;
    }

    // Set up polling interval (100ms for smooth transitions)
    intervalRef.current = window.setInterval(updateActiveBlock, 100);

    // Initial update
    updateActiveBlock();
  }, [enabled, updateActiveBlock]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Reset when segment map changes
  useEffect(() => {
    if (audioRef.current) {
      updateActiveBlock();
    }
  }, [segmentMap, updateActiveBlock]);

  // Helper to check if a specific block is active
  const isBlockActive = useCallback((blockId: string): boolean => {
    return activeBlockId === blockId;
  }, [activeBlockId]);

  return {
    activeBlockId,
    currentPercent,
    isBlockActive,
    setAudioRef,
  };
}

/**
 * Parse segment map from slide data
 * Falls back to proportional distribution if no mapping exists
 */
export function parseSegmentMap(slide: {
  audio_segment_map?: AudioSegment[];
  audio_duration_seconds?: number;
  content?: {
    main_text?: string;
    key_points?: string[];
    definition?: unknown;
    example?: unknown;
    steps?: { step: number }[];
  };
}): AudioSegment[] {
  // Use AI-generated map if available
  if (slide.audio_segment_map?.length) {
    return slide.audio_segment_map;
  }

  // Generate proportional fallback
  const blocks: { id: string; weight: number }[] = [];
  
  if (slide.content?.main_text) {
    blocks.push({ id: 'main_text', weight: 30 });
  }
  
  if (slide.content?.key_points?.length) {
    const pointWeight = 50 / slide.content.key_points.length;
    slide.content.key_points.forEach((_, i) => {
      blocks.push({ id: `key_point_${i}`, weight: pointWeight });
    });
  }
  
  if (slide.content?.definition) {
    blocks.push({ id: 'definition', weight: 15 });
  }
  
  if (slide.content?.example) {
    blocks.push({ id: 'example', weight: 20 });
  }

  if (slide.content?.steps?.length) {
    const stepWeight = 40 / slide.content.steps.length;
    slide.content.steps.forEach((step) => {
      blocks.push({ id: `step_${step.step}`, weight: stepWeight });
    });
  }

  if (blocks.length === 0) {
    return [{ target_block: 'main_text', start_percent: 0, end_percent: 100 }];
  }

  // Normalize weights and create segments
  const totalWeight = blocks.reduce((sum, b) => sum + b.weight, 0);
  const segments: AudioSegment[] = [];
  let currentPercent = 0;

  blocks.forEach((block, i) => {
    const proportion = block.weight / totalWeight;
    const endPercent = i === blocks.length - 1 ? 100 : currentPercent + proportion * 100;
    
    segments.push({
      target_block: block.id,
      start_percent: Math.round(currentPercent),
      end_percent: Math.round(endPercent),
    });
    
    currentPercent = endPercent;
  });

  return segments;
}

export default useSlideSync;
