import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { StudentEnrollment } from '@/hooks/useStudentCourses';
import { ProgressRing } from '@/components/common/ProgressRing';
import { cn } from '@/lib/utils';

interface StudentCourseCardProps {
  enrollment: StudentEnrollment;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function StudentCourseCard({
  enrollment,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: StudentCourseCardProps) {
  const navigate = useNavigate();
  const course = enrollment.instructor_course;
  const progress = enrollment.overall_progress || 0;
  const isCompleted = !!enrollment.completed_at;

  const enrolledDate = new Date(enrollment.enrolled_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode && onToggleSelect) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect();
    }
  };

  return (
    <Card 
      className={cn(
        "hover:shadow-md transition-all relative",
        isSelectionMode && "cursor-pointer",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      onClick={handleCardClick}
    >
      {isSelectionMode && (
        <div className="absolute top-3 left-3 z-10">
          <Checkbox 
            checked={isSelected} 
            onCheckedChange={() => onToggleSelect?.()}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 bg-background"
          />
        </div>
      )}
      <CardHeader className={cn("pb-3", isSelectionMode && "pl-12")}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {course.title}
            </CardTitle>
            {course.code && (
              <CardDescription className="font-mono">
                {course.code}
              </CardDescription>
            )}
          </div>
          {isCompleted ? (
            <Badge className="bg-success/10 text-success">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Completed
            </Badge>
          ) : (
            <Badge variant="outline">
              <Clock className="mr-1 h-3 w-3" />
              In Progress
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {course.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {course.description}
          </p>
        )}

        <div className="space-y-3">
          {/* Visual Progress Ring */}
          <div className="flex items-center gap-4">
            <ProgressRing
              progress={progress}
              size="md"
              color={isCompleted ? 'success' : progress >= 75 ? 'accent' : 'primary'}
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Enrolled {enrolledDate}
          </span>
          {!isSelectionMode && (
            <Button
              size="sm"
              onClick={() => navigate(`/learn/courses/${course.id}`)}
            >
              Continue Learning
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
