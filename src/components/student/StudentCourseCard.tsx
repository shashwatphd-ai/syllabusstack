import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock, ArrowRight, Layers } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { StudentEnrollment } from '@/hooks/useStudentCourses';
import { ProgressRing } from '@/components/common/ProgressRing';

interface StudentCourseCardProps {
  enrollment: StudentEnrollment;
  modulesCompleted?: number;
  totalModules?: number;
}

export function StudentCourseCard({ enrollment, modulesCompleted, totalModules }: StudentCourseCardProps) {
  const navigate = useNavigate();
  const course = enrollment.instructor_course;
  const progress = enrollment.overall_progress || 0;
  const isCompleted = !!enrollment.completed_at;

  const enrolledDate = new Date(enrollment.enrolled_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
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
              {totalModules !== undefined && totalModules > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Layers className="h-3 w-3" />
                  <span>
                    {modulesCompleted ?? 0}/{totalModules} modules completed
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Enrolled {enrolledDate}
          </span>
          <Button
            size="sm"
            onClick={() => navigate(`/learn/courses/${course.id}`)}
          >
            Continue Learning
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
