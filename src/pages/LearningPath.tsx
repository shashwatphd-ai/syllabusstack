import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Target,
  BookOpen,
  Award,
  TrendingUp,
  ChevronRight,
  Sparkles,
  GraduationCap,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { LearningPathVisualization } from '@/components/student/LearningPathVisualization';
import { useDreamJobs } from '@/hooks/useDreamJobs';
import { useStudentEnrollments } from '@/hooks/useStudentCourses';
import { useVerifiedSkills } from '@/hooks/useVerifiedSkills';
import { useRecommendations } from '@/hooks/useRecommendations';
import { cn } from '@/lib/utils';

export default function LearningPathPage() {
  const { data: dreamJobs = [], isLoading: djLoading } = useDreamJobs();
  const { data: courses = [], isLoading: coursesLoading } = useStudentEnrollments();
  const { data: verifiedSkills = [], isLoading: skillsLoading } = useVerifiedSkills();

  const [selectedDreamJobId, setSelectedDreamJobId] = useState<string | undefined>(
    dreamJobs[0]?.id
  );

  const { data: recommendations = [], isLoading: recsLoading } = useRecommendations(selectedDreamJobId);

  const isLoading = djLoading || coursesLoading || skillsLoading || recsLoading;

  // Calculate stats
  const completedCourses = courses.filter((c) => (c.overall_progress || 0) >= 100).length;
  const inProgressCourses = courses.filter(
    (c) => (c.overall_progress || 0) > 0 && (c.overall_progress || 0) < 100
  ).length;
  const completedRecs = recommendations.filter((r) => r.status === 'completed').length;
  const totalRecs = recommendations.length;
  const selectedJob = dreamJobs.find((j) => j.id === selectedDreamJobId);

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            Your Learning Path
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your progress toward your career goals
          </p>
        </div>

        {/* Dream job selector */}
        {dreamJobs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Path to:</span>
            <Select
              value={selectedDreamJobId}
              onValueChange={setSelectedDreamJobId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select dream job" />
              </SelectTrigger>
              <SelectContent>
                {dreamJobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label="Courses"
          value={courses.length}
          subtext={`${completedCourses} completed`}
          iconColor="text-blue-600"
        />
        <StatCard
          icon={Award}
          label="Verified Skills"
          value={verifiedSkills.length}
          subtext="Earned through courses"
          iconColor="text-green-600"
        />
        <StatCard
          icon={Sparkles}
          label="Recommendations"
          value={`${completedRecs}/${totalRecs}`}
          subtext={totalRecs > 0 ? `${Math.round((completedRecs / totalRecs) * 100)}% done` : 'Set a dream job'}
          iconColor="text-purple-600"
        />
        <StatCard
          icon={Target}
          label="Career Match"
          value={selectedJob?.match_score ? `${selectedJob.match_score}%` : '--'}
          subtext={selectedJob?.title || 'No job selected'}
          iconColor="text-amber-600"
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="path" className="space-y-6">
        <TabsList>
          <TabsTrigger value="path" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Visual Path
          </TabsTrigger>
          <TabsTrigger value="milestones" className="gap-2">
            <Calendar className="h-4 w-4" />
            Milestones
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2">
            <Award className="h-4 w-4" />
            Skills Gained
          </TabsTrigger>
        </TabsList>

        <TabsContent value="path">
          <LearningPathVisualization
            dreamJobId={selectedDreamJobId}
            maxItems={15}
          />
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <CardTitle>Learning Milestones</CardTitle>
              <CardDescription>
                Key achievements on your path to {selectedJob?.title || 'your dream job'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Completed courses as milestones */}
                {courses
                  .filter((c) => (c.overall_progress || 0) >= 100)
                  .map((course) => (
                    <MilestoneItem
                      key={course.id}
                      title={course.instructor_course?.title || 'Course'}
                      type="Course Completed"
                      date={course.completed_at}
                      isComplete
                    />
                  ))}

                {/* Verified skills as milestones */}
                {verifiedSkills.map((skill) => (
                  <MilestoneItem
                    key={skill.id}
                    title={skill.skill_name}
                    type="Skill Verified"
                    date={skill.verified_at}
                    isComplete
                  />
                ))}

                {/* Pending recommendations as future milestones */}
                {recommendations
                  .filter((r) => r.status !== 'completed')
                  .slice(0, 5)
                  .map((rec) => (
                    <MilestoneItem
                      key={rec.id}
                      title={rec.title}
                      type="Upcoming"
                      isComplete={false}
                    />
                  ))}

                {courses.length === 0 && verifiedSkills.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No milestones yet. Start learning to track your progress!</p>
                    <Button asChild className="mt-4">
                      <Link to="/courses">Browse Courses</Link>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills">
          <Card>
            <CardHeader>
              <CardTitle>Skills Portfolio</CardTitle>
              <CardDescription>
                Skills you've gained and verified through your learning journey
              </CardDescription>
            </CardHeader>
            <CardContent>
              {verifiedSkills.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {verifiedSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Award className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{skill.skill_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {skill.proficiency_level}
                          </Badge>
                          <span>via {skill.source_name || 'Course Assessment'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No verified skills yet.</p>
                  <p className="text-sm mt-1">
                    Complete course assessments to earn verified skills.
                  </p>
                  <Button asChild className="mt-4">
                    <Link to="/courses">Start Learning</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/courses">
                <BookOpen className="h-4 w-4 mr-2" />
                Add Course
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/career-path">
                <Target className="h-4 w-4 mr-2" />
                Update Dream Job
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/skills-assessment">
                <BarChart3 className="h-4 w-4 mr-2" />
                Take Assessment
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/progress">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Progress
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Stat card component
function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext: string;
  iconColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg bg-muted', iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-2">{subtext}</div>
      </CardContent>
    </Card>
  );
}

// Milestone item component
function MilestoneItem({
  title,
  type,
  date,
  isComplete,
}: {
  title: string;
  type: string;
  date?: string | null;
  isComplete: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          'w-3 h-3 rounded-full',
          isComplete ? 'bg-green-500' : 'bg-muted border-2 border-dashed border-muted-foreground'
        )}
      />
      <div className="flex-1">
        <div className={cn('font-medium', !isComplete && 'text-muted-foreground')}>
          {title}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {type}
          </Badge>
          {date && (
            <span>
              {new Date(date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>
      {isComplete && <Award className="h-4 w-4 text-green-500" />}
    </div>
  );
}
