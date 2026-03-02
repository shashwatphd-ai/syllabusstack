import { useNavigate } from 'react-router-dom';
import { InviteColleagues } from '@/components/instructor/InviteColleagues';
import {
  School,
  BookOpen,
  Sparkles,
  Users,
  Award,
  ArrowRight,
  Shield,
  AlertCircle,
  CheckCircle2,
  Video,
  FileText
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useInstructorCourses } from '@/hooks/useInstructorCourses';

/**
 * Teach Page - Landing page for instructor features
 *
 * This page serves two purposes:
 * 1. For non-instructors: Marketing page to encourage becoming an instructor
 * 2. For instructors: Quick access dashboard to courses and verification
 *
 * Impact: Makes instructor features discoverable for all users
 */
export default function TeachPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: roles, isLoading: rolesLoading } = useUserRoles();
  const { data: courses, isLoading: coursesLoading } = useInstructorCourses();

  const isInstructor = roles?.some(r => r.role === 'instructor' || r.role === 'admin');
  const isVerified = profile?.is_instructor_verified;

  // Loading state
  if (rolesLoading) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  // ============================================================
  // INSTRUCTOR VIEW - Show quick access dashboard
  // ============================================================
  if (isInstructor) {
    const publishedCourses = courses?.filter(c => c.is_published).length || 0;
    const draftCourses = courses?.filter(c => !c.is_published).length || 0;

    return (
      <AppShell>
        <PageContainer>
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <School className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Instructor Dashboard</h1>
                  <p className="text-muted-foreground">
                    Manage your courses and track student progress
                  </p>
                </div>
              </div>

              {/* Verification Status */}
              {!isVerified && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-warning/50 bg-warning/5">
                  <AlertCircle className="h-5 w-5 text-warning shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Complete Your Verification</p>
                    <p className="text-sm text-muted-foreground">
                      Verified instructors can issue certificates and build trust with students.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1"
                    onClick={() => navigate('/instructor/verification')}
                  >
                    Verify Now
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {isVerified && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Verified Instructor</span>
                  {profile?.instructor_trust_score && (
                    <Badge variant="secondary" className="ml-2">
                      Trust Score: {profile.instructor_trust_score}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{courses?.length || 0}</p>
                      <p className="text-sm text-muted-foreground">Total Courses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{publishedCourses}</p>
                      <p className="text-sm text-muted-foreground">Published</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/10">
                      <FileText className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{draftCourses}</p>
                      <p className="text-sm text-muted-foreground">Drafts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate('/instructor/courses')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="h-5 w-5 text-primary" />
                    My Courses
                  </CardTitle>
                  <CardDescription>
                    View and manage all your courses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full gap-2">
                    Go to Courses
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate('/instructor/quick-setup')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Create New Course
                  </CardTitle>
                  <CardDescription>
                    AI-powered course creation from syllabus
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full gap-2">
                    Quick Setup
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Invite Colleagues */}
            <InviteColleagues />

            {/* Recent Courses */}
            {courses && courses.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Recent Courses</h2>
                <div className="space-y-2">
                  {courses.slice(0, 3).map(course => (
                    <Card
                      key={course.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/instructor/courses/${course.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{course.title}</p>
                              {course.code && (
                                <p className="text-sm text-muted-foreground">{course.code}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant={course.is_published ? 'default' : 'secondary'}>
                            {course.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  // ============================================================
  // NON-INSTRUCTOR VIEW - Marketing page to become instructor
  // ============================================================
  return (
    <AppShell>
      <PageContainer>
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
              <School className="h-5 w-5" />
              <span className="font-medium">For Educators</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">
              Share Your Knowledge with the World
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Create AI-powered courses from your syllabus in minutes.
              Help students learn with curated video content and interactive assessments.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">AI-Powered Creation</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-sm text-muted-foreground">
                Upload your syllabus and let AI extract learning objectives
                and find matching video content automatically.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Track Progress</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-sm text-muted-foreground">
                Monitor student engagement and progress with detailed
                analytics and completion tracking.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Issue Certificates</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-sm text-muted-foreground">
                Verified instructors can issue completion certificates
                that employers can verify.
              </CardContent>
            </Card>
          </div>

          {/* How It Works */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-center">How It Works</h2>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { step: 1, title: 'Upload Syllabus', desc: 'PDF or DOCX', icon: FileText },
                { step: 2, title: 'AI Analysis', desc: 'Extract objectives', icon: Sparkles },
                { step: 3, title: 'Find Content', desc: 'Curated videos', icon: Video },
                { step: 4, title: 'Publish', desc: 'Share with students', icon: CheckCircle2 },
              ].map(item => (
                <div key={item.step} className="text-center">
                  <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <span className="text-primary font-bold">{item.step}</span>
                  </div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6 pb-6">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold">Instructor Access is Invite-Only</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  To teach on SyllabusStack, you need an invitation from an existing instructor.
                  Ask a colleague who already teaches on the platform.
                </p>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2"
                  onClick={() => navigate('/become-instructor')}
                >
                  Learn More
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Common Questions</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base font-medium">How much does it cost?</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  Course creation is $1 per course for free tier users.
                  Pro subscribers get unlimited course creation.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base font-medium">How do I get access?</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  Instructor access is invite-only. Ask a colleague who already teaches
                  on SyllabusStack to send you an invitation from their dashboard.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base font-medium">What content can I use?</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  Our AI finds publicly available YouTube videos that match your learning objectives.
                  You review and approve all content before publishing.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base font-medium">Can students pay for courses?</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  Currently, courses are shared via access codes. Paid course features
                  are coming soon.
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
