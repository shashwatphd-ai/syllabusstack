import { GraduationCap, ExternalLink, Unlink, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LinkedCourseProgressProps {
  courseId: string;
  courseTitle: string;
  progress: number;
  isCompleted?: boolean;
  onUnlink?: () => void;
  isUnlinking?: boolean;
  compact?: boolean;
}

export function LinkedCourseProgress({
  courseId,
  courseTitle,
  progress,
  isCompleted = false,
  onUnlink,
  isUnlinking = false,
  compact = false,
}: LinkedCourseProgressProps) {
  const navigate = useNavigate();

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Badge 
          variant="outline" 
          className={cn(
            "gap-1 px-2 py-0.5",
            isCompleted 
              ? "bg-success/10 text-success border-success/30"
              : "bg-indigo-50 text-indigo-700 border-indigo-200"
          )}
        >
          <GraduationCap className="h-3 w-3" />
          <span className="truncate max-w-[100px]">{courseTitle}</span>
          <span className="font-semibold">{progress}%</span>
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-indigo-50/70 rounded-lg border border-indigo-200">
      <div className="p-1.5 bg-indigo-100 rounded-md">
        <GraduationCap className="h-4 w-4 text-indigo-600" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-indigo-900 truncate">
            {courseTitle}
          </span>
          {isCompleted && (
            <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/30">
              Complete
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-xs font-medium text-indigo-700 shrink-0">
            {progress}%
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
                onClick={() => navigate(`/learn/courses/${courseId}`)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Go to course</TooltipContent>
          </Tooltip>

          {onUnlink && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={onUnlink}
                  disabled={isUnlinking}
                >
                  {isUnlinking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Unlink course</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
