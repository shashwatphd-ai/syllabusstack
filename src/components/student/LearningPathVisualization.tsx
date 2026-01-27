import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Target,
  CheckCircle2,
  Circle,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Award,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useStudentEnrollments } from '@/hooks/useStudentCourses';
import { useDreamJobs } from '@/hooks/useDreamJobs';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useVerifiedSkills } from '@/hooks/useVerifiedSkills';

interface PathNode {
  id: string;
  type: 'course' | 'recommendation' | 'skill' | 'dream-job';
  title: string;
  status: 'completed' | 'in-progress' | 'pending' | 'recommended';
  progress?: number;
  link?: string;
  metadata?: {
    code?: string;
    skills?: string[];
    matchScore?: number;
  };
}

interface LearningPathVisualizationProps {
  dreamJobId?: string;
  compact?: boolean;
  maxItems?: number;
}

export function LearningPathVisualization({
  dreamJobId,
  compact = false,
  maxItems = 10,
}: LearningPathVisualizationProps) {
  const { data: courses = [], isLoading: coursesLoading } = useStudentEnrollments();
  const { data: dreamJobs = [], isLoading: dreamJobsLoading } = useDreamJobs();
  const { data: recommendations = [], isLoading: recsLoading } = useRecommendations(dreamJobId);
  const { data: verifiedSkills = [], isLoading: skillsLoading } = useVerifiedSkills();

  const isLoading = coursesLoading || dreamJobsLoading || recsLoading || skillsLoading;

  // Build the learning path nodes
  const pathNodes = useMemo(() => {
    const nodes: PathNode[] = [];

    // Add enrolled courses
    courses.slice(0, maxItems / 2).forEach((course) => {
      const progress = course.overall_progress || 0;
      nodes.push({
        id: `course-${course.instructor_course_id}`,
        type: 'course',
        title: course.instructor_course?.title || 'Untitled Course',
        status: progress >= 100 ? 'completed' : progress > 0 ? 'in-progress' : 'pending',
        progress,
        link: `/courses/${course.instructor_course_id}`,
        metadata: {
          code: course.instructor_course?.code,
        },
      });
    });

    // Add recommendations as future steps
    recommendations
      .filter((r) => r.status !== 'completed' && r.type === 'course')
      .slice(0, 3)
      .forEach((rec) => {
        nodes.push({
          id: `rec-${rec.id}`,
          type: 'recommendation',
          title: rec.title,
          status: 'recommended',
          link: rec.linked_course_id ? `/courses/${rec.linked_course_id}` : undefined,
          metadata: {
            skills: rec.gap_addressed ? [rec.gap_addressed] : [],
          },
        });
      });

    // Add verified skills as milestones
    verifiedSkills.slice(0, 3).forEach((skill) => {
      nodes.push({
        id: `skill-${skill.id}`,
        type: 'skill',
        title: skill.skill_name,
        status: 'completed',
      });
    });

    return nodes;
  }, [courses, recommendations, verifiedSkills, maxItems]);

  // Get the target dream job
  const targetDreamJob = dreamJobs.find((j) => j.id === dreamJobId) || dreamJobs[0];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            <span>Loading your learning path...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pathNodes.length === 0 && !targetDreamJob) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Start Your Learning Journey</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add courses and set a dream job to see your personalized learning path.
          </p>
          <div className="flex gap-2 justify-center">
            <Button asChild size="sm">
              <Link to="/courses">
                <BookOpen className="h-4 w-4 mr-2" />
                Add Courses
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/career-path">
                <Target className="h-4 w-4 mr-2" />
                Set Dream Job
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedCount = pathNodes.filter((n) => n.status === 'completed').length;
  const totalCount = pathNodes.length + 1; // +1 for dream job
  const overallProgress = Math.round((completedCount / totalCount) * 100);

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Learning Path
            </CardTitle>
            <Link to="/learning-path" className="text-xs text-primary hover:underline">
              View Full Path
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Progress overview */}
            <div className="flex items-center gap-3">
              <Progress value={overallProgress} className="flex-1 h-2" />
              <span className="text-sm font-medium">{overallProgress}%</span>
            </div>

            {/* Compact node list */}
            <div className="flex items-center gap-1 overflow-x-auto py-2">
              {pathNodes.slice(0, 5).map((node, index) => (
                <div key={node.id} className="flex items-center">
                  <NodeBadge node={node} compact />
                  {index < Math.min(pathNodes.length - 1, 4) && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground mx-1 flex-shrink-0" />
                  )}
                </div>
              ))}
              {targetDreamJob && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground mx-1 flex-shrink-0" />
                  <Badge variant="outline" className="gap-1 flex-shrink-0 bg-amber-50 border-amber-200 text-amber-700">
                    <Target className="h-3 w-3" />
                    {targetDreamJob.title.length > 15
                      ? targetDreamJob.title.substring(0, 15) + '...'
                      : targetDreamJob.title}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Your Learning Path
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {overallProgress}% to {targetDreamJob?.title || 'Dream Job'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{completedCount} of {totalCount} milestones</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
        </div>

        {/* Visual path */}
        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border" />

          {/* Nodes */}
          <div className="space-y-4 relative">
            {/* Start node */}
            <PathNodeItem
              node={{
                id: 'start',
                type: 'skill',
                title: 'Starting Point',
                status: 'completed',
              }}
              isFirst
            />

            {/* Path nodes */}
            {pathNodes.map((node, index) => (
              <PathNodeItem key={node.id} node={node} index={index} />
            ))}

            {/* Dream job destination */}
            {targetDreamJob && (
              <div className="flex items-start gap-4 relative">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center z-10',
                    'bg-amber-100 text-amber-700 border-2 border-amber-300'
                  )}
                >
                  <Target className="h-5 w-5" />
                </div>
                <div className="flex-1 pt-1">
                  <Link
                    to={`/dream-jobs/${targetDreamJob.id}`}
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {targetDreamJob.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                      Dream Job
                    </Badge>
                    {targetDreamJob.match_score !== null && (
                      <Badge variant="outline" className="text-xs">
                        {targetDreamJob.match_score}% Match
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete the steps above to reach your career goal
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-muted border" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-purple-100 border border-purple-300" />
            <span>Recommended</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Individual path node item
function PathNodeItem({
  node,
  index,
  isFirst,
}: {
  node: PathNode;
  index?: number;
  isFirst?: boolean;
}) {
  const statusConfig = getStatusConfig(node.status);
  const typeConfig = getTypeConfig(node.type);

  return (
    <div className="flex items-start gap-4 relative">
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center z-10',
          statusConfig.bgClass,
          statusConfig.textClass,
          statusConfig.borderClass
        )}
      >
        {node.status === 'completed' ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : node.status === 'in-progress' ? (
          <div className="relative">
            <Circle className="h-5 w-5" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[8px] font-bold">{node.progress}%</span>
            </div>
          </div>
        ) : (
          <typeConfig.icon className="h-5 w-5" />
        )}
      </div>
      <div className="flex-1 pt-1">
        {node.link ? (
          <Link to={node.link} className="font-medium hover:text-primary transition-colors">
            {node.title}
          </Link>
        ) : (
          <span className="font-medium">{node.title}</span>
        )}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={cn('text-xs', typeConfig.badgeClass)}>
            {typeConfig.label}
          </Badge>
          {node.metadata?.code && (
            <span className="text-xs text-muted-foreground">{node.metadata.code}</span>
          )}
        </div>
        {node.status === 'in-progress' && node.progress !== undefined && (
          <div className="mt-2 flex items-center gap-2">
            <Progress value={node.progress} className="flex-1 h-1.5" />
            <span className="text-xs text-muted-foreground">{node.progress}%</span>
          </div>
        )}
        {node.metadata?.skills && node.metadata.skills.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Skills: {node.metadata.skills.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

// Compact node badge
function NodeBadge({ node, compact }: { node: PathNode; compact?: boolean }) {
  const statusConfig = getStatusConfig(node.status);
  const typeConfig = getTypeConfig(node.type);

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 flex-shrink-0',
        statusConfig.badgeClass
      )}
    >
      {node.status === 'completed' ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <typeConfig.icon className="h-3 w-3" />
      )}
      {compact
        ? node.title.length > 12
          ? node.title.substring(0, 12) + '...'
          : node.title
        : node.title}
    </Badge>
  );
}

// Status configuration
function getStatusConfig(status: PathNode['status']) {
  switch (status) {
    case 'completed':
      return {
        bgClass: 'bg-green-100',
        textClass: 'text-green-700',
        borderClass: 'border-2 border-green-300',
        badgeClass: 'bg-green-50 border-green-200 text-green-700',
      };
    case 'in-progress':
      return {
        bgClass: 'bg-blue-100',
        textClass: 'text-blue-700',
        borderClass: 'border-2 border-blue-300',
        badgeClass: 'bg-blue-50 border-blue-200 text-blue-700',
      };
    case 'recommended':
      return {
        bgClass: 'bg-purple-100',
        textClass: 'text-purple-700',
        borderClass: 'border-2 border-purple-300 border-dashed',
        badgeClass: 'bg-purple-50 border-purple-200 text-purple-700',
      };
    default:
      return {
        bgClass: 'bg-muted',
        textClass: 'text-muted-foreground',
        borderClass: 'border-2 border-border',
        badgeClass: 'bg-muted border-border text-muted-foreground',
      };
  }
}

// Type configuration
function getTypeConfig(type: PathNode['type']) {
  switch (type) {
    case 'course':
      return { icon: BookOpen, label: 'Course', badgeClass: '' };
    case 'recommendation':
      return { icon: Sparkles, label: 'Recommended', badgeClass: '' };
    case 'skill':
      return { icon: Award, label: 'Skill', badgeClass: '' };
    case 'dream-job':
      return { icon: Target, label: 'Dream Job', badgeClass: '' };
    default:
      return { icon: Circle, label: 'Step', badgeClass: '' };
  }
}
