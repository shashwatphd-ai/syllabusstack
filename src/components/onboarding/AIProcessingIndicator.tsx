import { useState, useEffect } from 'react';
import { Loader2, Brain, Sparkles, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface AIProcessingIndicatorProps {
  isProcessing: boolean;
  type: 'syllabus' | 'dreamJob' | 'gap';
  onComplete?: () => void;
}

const processingMessages = {
  syllabus: [
    { message: 'Reading course content...', duration: 2000 },
    { message: 'Identifying learning objectives...', duration: 2500 },
    { message: 'Extracting concrete capabilities...', duration: 3000 },
    { message: 'Mapping tools and methods...', duration: 2000 },
    { message: 'Finalizing analysis...', duration: 1500 },
  ],
  dreamJob: [
    { message: 'Researching job requirements...', duration: 2000 },
    { message: 'Analyzing day-one expectations...', duration: 2500 },
    { message: 'Identifying key differentiators...', duration: 2000 },
    { message: 'Setting realistic hiring bar...', duration: 2000 },
    { message: 'Compiling job profile...', duration: 1500 },
  ],
  gap: [
    { message: 'Comparing your capabilities...', duration: 2000 },
    { message: 'Identifying skill overlaps...', duration: 2500 },
    { message: 'Analyzing gaps...', duration: 2500 },
    { message: 'Calculating match score...', duration: 2000 },
    { message: 'Generating insights...', duration: 1500 },
  ],
};

export function AIProcessingIndicator({ 
  isProcessing, 
  type,
  onComplete 
}: AIProcessingIndicatorProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const messages = processingMessages[type];

  useEffect(() => {
    if (!isProcessing) {
      setCurrentMessageIndex(0);
      setProgress(0);
      return;
    }

    let totalDuration = 0;
    const durations = messages.map(m => {
      totalDuration += m.duration;
      return totalDuration;
    });

    const totalTime = durations[durations.length - 1];
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min((elapsed / totalTime) * 100, 95);
      setProgress(currentProgress);

      // Find current message based on elapsed time
      const messageIndex = durations.findIndex(d => elapsed < d);
      if (messageIndex !== -1 && messageIndex !== currentMessageIndex) {
        setCurrentMessageIndex(messageIndex);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isProcessing, messages, currentMessageIndex]);

  useEffect(() => {
    if (!isProcessing && progress > 0) {
      setProgress(100);
      const timeout = setTimeout(() => {
        onComplete?.();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isProcessing, progress, onComplete]);

  if (!isProcessing && progress === 0) return null;

  const currentMessage = messages[currentMessageIndex] || messages[messages.length - 1];
  const isComplete = !isProcessing && progress >= 100;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
          isComplete 
            ? "bg-green-500/10" 
            : "bg-primary/10"
        )}>
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Brain className="h-5 w-5 text-primary animate-pulse" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {isComplete ? 'Analysis Complete!' : 'AI Processing'}
            </span>
            {!isComplete && (
              <Sparkles className="h-3 w-3 text-primary animate-pulse" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isComplete ? 'Your results are ready.' : currentMessage.message}
          </p>
        </div>
        {!isComplete && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
}
