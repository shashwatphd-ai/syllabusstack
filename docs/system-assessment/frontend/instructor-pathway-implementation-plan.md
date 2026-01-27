# Instructor Pathway - Production Ready Implementation Plan

**Version:** 1.0
**Created:** January 26, 2026
**Status:** Ready for Implementation

---

## Overview

This document provides a complete, production-ready implementation plan to improve the instructor experience from signup through course publishing. The plan is organized into 4 phases with specific tasks, code changes, and acceptance criteria.

### Goals
1. Enable self-service instructor signup
2. Make instructor features discoverable
3. Integrate verification into the course creation flow
4. Simplify the course management experience

### Timeline Estimate
| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Quick Wins | 1-2 days | P0 |
| Phase 2: Become Instructor | 3-4 days | P0 |
| Phase 3: Verification Integration | 2-3 days | P1 |
| Phase 4: UX Simplification | 5-7 days | P2 |

---

## Phase 1: Quick Wins (1-2 days)

### Goal
Make instructor features discoverable without requiring the instructor role.

### Task 1.1: Add "Teach" Link to Main Navigation

**File:** `src/config/navigation.ts`

**Current Code:**
```typescript
export const mainNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, mobileLabel: 'Home' },
  { name: 'My Learning', href: '/learn', icon: GraduationCap, mobileLabel: 'Learn' },
  { name: 'Career Path', href: '/career', icon: Briefcase, mobileLabel: 'Career' },
];
```

**New Code:**
```typescript
import { School } from 'lucide-react';

export const mainNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, mobileLabel: 'Home' },
  { name: 'My Learning', href: '/learn', icon: GraduationCap, mobileLabel: 'Learn' },
  { name: 'Career Path', href: '/career', icon: Briefcase, mobileLabel: 'Career' },
  { name: 'Teach', href: '/teach', icon: School, mobileLabel: 'Teach' },
];
```

**Acceptance Criteria:**
- [ ] "Teach" link visible in sidebar for all authenticated users
- [ ] "Teach" link appears in mobile navigation
- [ ] Clicking navigates to `/teach` route

---

### Task 1.2: Create Teach Landing Page

**New File:** `src/pages/Teach.tsx`

```typescript
import { useNavigate } from 'react-router-dom';
import { School, CheckCircle2, Sparkles, Users, Award, ArrowRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';

export default function TeachPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: roles } = useUserRoles();

  const isInstructor = roles?.some(r => r.role === 'instructor' || r.role === 'admin');
  const isVerified = profile?.is_instructor_verified;

  // If already an instructor, redirect to instructor portal
  if (isInstructor) {
    return (
      <AppShell>
        <PageContainer>
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                <School className="h-5 w-5" />
                <span className="font-medium">Instructor Portal</span>
              </div>
              <h1 className="text-3xl font-bold">Welcome Back, Instructor!</h1>
              {!isVerified && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Complete verification to unlock all features
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate('/instructor/courses')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    My Courses
                  </CardTitle>
                  <CardDescription>
                    Manage your courses and content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full gap-2">
                    Go to Courses
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate('/instructor/quick-setup')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
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

            {!isVerified && (
              <Card className="border-warning/50 bg-warning/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warning">
                    <Shield className="h-5 w-5" />
                    Complete Your Verification
                  </CardTitle>
                  <CardDescription>
                    Verified instructors can issue certificates and build trust with students
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => navigate('/instructor/verification')} className="gap-2">
                    Verify Now
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  // Non-instructor view: Become an Instructor
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
            <h1 className="text-4xl font-bold">
              Share Your Knowledge with the World
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create AI-powered courses from your syllabus in minutes.
              Help students learn with curated video content and interactive assessments.
            </p>
          </div>

          {/* Benefits */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">AI-Powered Creation</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                Upload your syllabus and let AI extract learning objectives
                and find matching video content automatically.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Track Progress</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                Monitor student engagement and progress with detailed
                analytics and completion tracking.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Issue Certificates</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                Verified instructors can issue completion certificates
                that employers can verify.
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold">Ready to Start Teaching?</h2>
                <p className="text-muted-foreground">
                  Become a verified instructor and create your first course today.
                </p>
                <Button size="lg" className="gap-2" onClick={() => navigate('/become-instructor')}>
                  Become an Instructor
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* FAQ Preview */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Common Questions</h3>
            <div className="grid gap-4">
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
                  <CardTitle className="text-base font-medium">Do I need a .edu email?</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  No, but .edu emails are automatically verified. Other emails
                  require a brief manual review (1-2 business days).
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
```

**Acceptance Criteria:**
- [ ] Non-instructors see "Become an Instructor" landing page
- [ ] Existing instructors see quick access to courses and verification
- [ ] Unverified instructors see verification prompt
- [ ] Benefits and FAQ are clearly displayed

---

### Task 1.3: Add Route for Teach Page

**File:** `src/App.tsx`

Add to protected routes:
```typescript
<Route path="/teach" element={<AuthGuard><Teach /></AuthGuard>} />
```

**Acceptance Criteria:**
- [ ] `/teach` route is accessible to authenticated users
- [ ] Unauthenticated users are redirected to login

---

### Task 1.4: Update Sidebar to Show "Teach" for Non-Instructors

**File:** `src/components/layout/Sidebar.tsx`

Ensure the "Teach" link from mainNavigation appears for all users.

**Acceptance Criteria:**
- [ ] All authenticated users see "Teach" in sidebar
- [ ] Instructors still see dedicated "Instructor" section below

---

## Phase 2: Become Instructor Flow (3-4 days)

### Goal
Create a self-service flow for users to become instructors.

### Task 2.1: Create Become Instructor Page

**New File:** `src/pages/BecomeInstructor.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Mail, Building2, Linkedin, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useInstructorVerification } from '@/hooks/useInstructorVerification';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Step = 'info' | 'verification' | 'processing' | 'complete';

export default function BecomeInstructorPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { submitVerification, isVerified } = useInstructorVerification();

  const [step, setStep] = useState<Step>('info');
  const [formData, setFormData] = useState({
    email: user?.email || '',
    institution: '',
    department: '',
    title: '',
    linkedinUrl: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already verified, redirect to teach page
  if (isVerified) {
    navigate('/teach');
    return null;
  }

  const isEduEmail = formData.email?.includes('.edu');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setStep('processing');

    try {
      // Step 1: Request instructor role
      const { error: roleError } = await supabase
        .from('instructor_role_requests')
        .insert({
          user_id: user?.id,
          email: formData.email,
          institution_name: formData.institution || null,
          department: formData.department || null,
          title: formData.title || null,
          linkedin_url: formData.linkedinUrl || null,
          status: isEduEmail ? 'auto_approved' : 'pending',
        });

      if (roleError) throw roleError;

      // Step 2: If .edu email, auto-assign instructor role
      if (isEduEmail) {
        const { error: assignError } = await supabase
          .from('user_roles')
          .insert({
            user_id: user?.id,
            role: 'instructor',
          });

        if (assignError && !assignError.message.includes('duplicate')) {
          throw assignError;
        }
      }

      // Step 3: Submit verification request
      await submitVerification.mutateAsync({
        email: formData.email,
        institution_name: formData.institution || undefined,
        department: formData.department || undefined,
        title: formData.title || undefined,
        linkedin_url: formData.linkedinUrl || undefined,
      });

      await refreshProfile();
      setStep('complete');

      toast({
        title: isEduEmail ? 'Welcome, Instructor!' : 'Request Submitted',
        description: isEduEmail
          ? 'Your instructor account is ready. You can start creating courses!'
          : 'We\'ll review your request within 1-2 business days.',
      });

    } catch (error) {
      console.error('Error becoming instructor:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit request. Please try again.',
        variant: 'destructive',
      });
      setStep('info');
    }

    setIsSubmitting(false);
  };

  const stepProgress = {
    info: 33,
    verification: 66,
    processing: 90,
    complete: 100,
  };

  return (
    <AppShell>
      <PageContainer>
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
              <School className="h-4 w-4" />
              Instructor Application
            </div>
            <h1 className="text-2xl font-bold">Become an Instructor</h1>
            <p className="text-muted-foreground">
              Complete this quick form to start creating courses
            </p>
          </div>

          {/* Progress */}
          <Progress value={stepProgress[step]} className="h-2" />

          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {step === 'complete' ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <Mail className="h-5 w-5 text-primary" />
                )}
                {step === 'complete' ? 'You\'re All Set!' : 'Your Information'}
              </CardTitle>
              <CardDescription>
                {step === 'complete'
                  ? 'Your instructor account is ready'
                  : '.edu emails are automatically verified'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {step === 'complete' ? (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <h3 className="text-lg font-semibold">
                      {isEduEmail ? 'Welcome to the Instructor Program!' : 'Request Submitted!'}
                    </h3>
                    <p className="text-muted-foreground mt-2">
                      {isEduEmail
                        ? 'You can now create and manage courses.'
                        : 'We\'ll notify you by email once approved (1-2 business days).'}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => navigate('/teach')}>
                      Go to Teach
                    </Button>
                    {isEduEmail && (
                      <Button className="flex-1 gap-2" onClick={() => navigate('/instructor/quick-setup')}>
                        Create Course
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : step === 'processing' ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-muted-foreground">Setting up your instructor account...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="your.email@university.edu"
                      />
                      {isEduEmail && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                      )}
                    </div>
                    {isEduEmail && (
                      <p className="text-xs text-success">
                        ✓ .edu email detected - you'll be automatically verified!
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Institution */}
                  <div className="space-y-2">
                    <Label htmlFor="institution">
                      Institution <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="institution"
                        value={formData.institution}
                        onChange={(e) => setFormData(prev => ({ ...prev, institution: e.target.value }))}
                        placeholder="University of Example"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Department & Title */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="Computer Science"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Professor"
                      />
                    </div>
                  </div>

                  {/* LinkedIn */}
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">
                      LinkedIn Profile <span className="text-muted-foreground">(speeds up review)</span>
                    </Label>
                    <div className="relative">
                      <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="linkedin"
                        value={formData.linkedinUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                        placeholder="https://linkedin.com/in/yourprofile"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!formData.email || isSubmitting}
                  >
                    {isEduEmail ? 'Become an Instructor' : 'Submit Application'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    By continuing, you agree to our Instructor Terms and Privacy Policy.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </AppShell>
  );
}
```

---

### Task 2.2: Create Database Table for Role Requests

**New Migration:** `supabase/migrations/YYYYMMDDHHMMSS_add_instructor_role_requests.sql`

```sql
-- Table to track instructor role requests
CREATE TABLE instructor_role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  institution_name TEXT,
  department TEXT,
  title TEXT,
  linkedin_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'auto_approved', 'approved', 'rejected')),
  reviewer_id UUID REFERENCES auth.users(id),
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- RLS policies
ALTER TABLE instructor_role_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
  ON instructor_role_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own request
CREATE POLICY "Users can create own request"
  ON instructor_role_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all requests"
  ON instructor_role_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all
CREATE POLICY "Admins can update requests"
  ON instructor_role_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Index for admin queue
CREATE INDEX idx_instructor_requests_status ON instructor_role_requests(status, created_at);
```

---

### Task 2.3: Add Route for Become Instructor

**File:** `src/App.tsx`

```typescript
<Route path="/become-instructor" element={<AuthGuard><BecomeInstructor /></AuthGuard>} />
```

---

### Task 2.4: Create Admin Approval Queue (Optional Enhancement)

**File:** `src/pages/admin/InstructorRequestQueue.tsx`

Add a page for admins to review and approve instructor requests.

---

## Phase 3: Verification Integration (2-3 days)

### Goal
Integrate verification prompts into the instructor workflow.

### Task 3.1: Add Verification Banner to Instructor Pages

**New Component:** `src/components/instructor/VerificationBanner.tsx`

```typescript
import { Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useInstructorVerification } from '@/hooks/useInstructorVerification';

export function VerificationBanner() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { verification, isVerified, trustScore } = useInstructorVerification();

  // Don't show if verified
  if (isVerified) return null;

  // Show pending state
  if (verification?.status === 'pending') {
    return (
      <Alert className="border-warning/50 bg-warning/5">
        <Shield className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">Verification Pending</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>Your verification is being reviewed (1-2 business days).</span>
        </AlertDescription>
      </Alert>
    );
  }

  // Show prompt to verify
  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Shield className="h-4 w-4 text-primary" />
      <AlertTitle>Verify Your Instructor Account</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>Verified instructors can issue certificates and build trust with students.</span>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 ml-4 shrink-0"
          onClick={() => navigate('/instructor/verification')}
        >
          Verify Now
          <ArrowRight className="h-3 w-3" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

---

### Task 3.2: Add Banner to InstructorCoursesPage

**File:** `src/pages/instructor/InstructorCourses.tsx`

Add after PageHeader:
```typescript
import { VerificationBanner } from '@/components/instructor/VerificationBanner';

// In component:
<VerificationBanner />
```

---

### Task 3.3: Add Verification Check Before Publishing

**File:** `src/pages/instructor/InstructorCourseDetail.tsx`

Add verification warning in publish validation:
```typescript
const { isVerified } = useInstructorVerification();

// In publishValidation:
const publishValidation = {
  ...existing,
  isVerified,
};

// In dialog:
{!publishValidation.isVerified && (
  <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/50 bg-warning/5">
    <Shield className="h-5 w-5 text-warning shrink-0 mt-0.5" />
    <div>
      <p className="font-medium text-warning text-sm">Instructor Not Verified</p>
      <p className="text-sm text-muted-foreground mt-1">
        Verified instructors can issue certificates. You can still publish,
        but students won't receive verified certificates.
      </p>
    </div>
  </div>
)}
```

---

## Phase 4: UX Simplification (5-7 days)

### Goal
Reduce complexity of the course management experience.

### Task 4.1: Create First-Time Instructor Wizard

**New Component:** `src/components/instructor/FirstCourseWizard.tsx`

A step-by-step wizard for first-time instructors:
1. **Welcome** - Introduction to the platform
2. **Upload** - Upload syllabus
3. **Review** - Review extracted modules/LOs
4. **Content** - Find and approve content
5. **Publish** - Publish course

---

### Task 4.2: Add Wizard Mode Toggle

Store in localStorage whether user has completed wizard:
```typescript
const hasCompletedWizard = localStorage.getItem('instructor_wizard_complete');
```

---

### Task 4.3: Simplify Course Detail Page

Break into sub-components:
- `CourseStructureTab.tsx` - Modules and LOs
- `CourseContentTab.tsx` - Content management
- `CourseSlidesTab.tsx` - Slide generation
- `CourseStudentsTab.tsx` - Student progress

---

### Task 4.4: Add Contextual Help

Add tooltips and help text for complex features:
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="outline">
      <HelpCircle className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Click to generate slides for all learning objectives using AI.</p>
  </TooltipContent>
</Tooltip>
```

---

## Testing Requirements

### Unit Tests

| Component | Test Cases |
|-----------|------------|
| `TeachPage` | Renders for non-instructors, redirects for instructors |
| `BecomeInstructorPage` | Form validation, .edu detection, submission |
| `VerificationBanner` | Shows/hides based on verification status |

### Integration Tests

| Flow | Test Cases |
|------|------------|
| Become Instructor | Complete flow from signup to course creation |
| Verification | Email verification, pending state, approval |
| Course Creation | Quick setup with new instructor account |

### E2E Tests

| Scenario | Steps |
|----------|-------|
| New Instructor Journey | Signup → Become Instructor → Create Course → Publish |
| Existing User Upgrade | Login → Become Instructor → Verify → Create Course |

---

## Rollout Plan

### Stage 1: Feature Flag
```typescript
const ENABLE_INSTRUCTOR_SELF_SIGNUP = process.env.VITE_ENABLE_INSTRUCTOR_SELF_SIGNUP === 'true';
```

### Stage 2: Beta Testing
- Enable for 10% of users
- Monitor error rates and conversion

### Stage 3: Full Rollout
- Enable for all users
- Remove feature flag

---

## Monitoring & Success Metrics

### Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Instructor signup conversion | +50% | New instructor signups / month |
| Time to first course | < 10 min | Median time from signup to course creation |
| Verification completion | > 80% | Verified / total instructors |
| Course publish rate | > 60% | Published / created courses |

### Error Tracking

Monitor for:
- Failed role assignments
- Verification submission errors
- Course creation failures

---

## Files to Create/Modify Summary

### New Files
- `src/pages/Teach.tsx`
- `src/pages/BecomeInstructor.tsx`
- `src/components/instructor/VerificationBanner.tsx`
- `src/components/instructor/FirstCourseWizard.tsx`
- `supabase/migrations/XXXXXX_add_instructor_role_requests.sql`

### Modified Files
- `src/config/navigation.ts` - Add "Teach" link
- `src/App.tsx` - Add routes
- `src/pages/instructor/InstructorCourses.tsx` - Add verification banner
- `src/pages/instructor/InstructorCourseDetail.tsx` - Add verification check
- `src/components/layout/Sidebar.tsx` - Show "Teach" for all users

---

## Appendix: Component Hierarchy

```
/teach
├── Non-Instructor View
│   ├── Hero Section
│   ├── Benefits Grid
│   └── CTA → /become-instructor
│
└── Instructor View
    ├── Quick Access Cards
    │   ├── My Courses → /instructor/courses
    │   └── Create Course → /instructor/quick-setup
    └── Verification Prompt (if not verified)

/become-instructor
├── Step 1: Information Form
│   ├── Email (with .edu detection)
│   ├── Institution
│   ├── Department & Title
│   └── LinkedIn
├── Step 2: Processing
└── Step 3: Complete
    ├── Success Message
    └── Next Steps

/instructor/courses
├── Verification Banner
├── Course List
└── Create Actions
    ├── Quick Setup (AI)
    └── Manual Create

/instructor/courses/:id
├── Verification Banner
├── Onboarding Progress
├── Stats Cards
└── Tabs
    ├── Course Structure
    └── Students
```
