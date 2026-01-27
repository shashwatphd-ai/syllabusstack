import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  School,
  Mail,
  Building2,
  Linkedin,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ArrowLeft,
  User,
  GraduationCap
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useInstructorVerification } from '@/hooks/useInstructorVerification';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Step = 'info' | 'processing' | 'complete';

/**
 * BecomeInstructor Page - Self-service instructor signup flow
 *
 * Flow:
 * 1. User fills out form with email, institution, etc.
 * 2. If .edu email: Auto-approve and assign instructor role
 * 3. If non-.edu: Submit for manual review (1-2 business days)
 *
 * Impact: Enables self-service instructor onboarding without admin intervention
 */
export default function BecomeInstructorPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { data: roles, refetch: refetchRoles } = useUserRoles();
  const { submitVerification, isVerified } = useInstructorVerification();

  const [step, setStep] = useState<Step>('info');
  const [formData, setFormData] = useState({
    email: '',
    institution: '',
    department: '',
    title: '',
    linkedinUrl: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);

  // Initialize email from user
  useEffect(() => {
    if (user?.email) {
      setFormData(prev => ({ ...prev, email: user.email || '' }));
    }
  }, [user?.email]);

  // Check if already an instructor
  const isInstructor = roles?.some(r => r.role === 'instructor' || r.role === 'admin');

  // Redirect if already an instructor
  useEffect(() => {
    if (isInstructor) {
      navigate('/teach');
    }
  }, [isInstructor, navigate]);

  const isEduEmail = formData.email?.toLowerCase().includes('.edu');

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!formData.email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    setStep('processing');

    try {
      // Step 1: Check if request already exists
      const { data: existingRequest } = await supabase
        .from('instructor_role_requests')
        .select('id, status')
        .eq('user_id', user?.id)
        .single();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          toast.info('Your request is already being reviewed');
          setStep('complete');
          setAutoApproved(false);
          return;
        }
        if (existingRequest.status === 'auto_approved' || existingRequest.status === 'approved') {
          // Already approved, just need to assign role
          await assignInstructorRole();
          return;
        }
      }

      // Step 2: Create instructor role request
      const { error: requestError } = await supabase
        .from('instructor_role_requests')
        .upsert({
          user_id: user?.id,
          email: formData.email,
          institution_name: formData.institution || null,
          department: formData.department || null,
          title: formData.title || null,
          linkedin_url: formData.linkedinUrl || null,
          status: isEduEmail ? 'auto_approved' : 'pending',
        }, {
          onConflict: 'user_id'
        });

      if (requestError) {
        console.error('Error creating request:', requestError);
        throw new Error('Failed to submit request');
      }

      // Step 3: If .edu email, auto-assign instructor role
      if (isEduEmail) {
        await assignInstructorRole();
        setAutoApproved(true);
      } else {
        setAutoApproved(false);
      }

      // Step 4: Submit verification request
      try {
        await submitVerification.mutateAsync({
          email: formData.email,
          institution_name: formData.institution || undefined,
          department: formData.department || undefined,
          title: formData.title || undefined,
          linkedin_url: formData.linkedinUrl || undefined,
        });
      } catch (verifyError) {
        // Verification might already exist, continue anyway
        console.log('Verification note:', verifyError);
      }

      await refreshProfile();
      await refetchRoles();
      setStep('complete');

      toast.success(
        isEduEmail
          ? 'Welcome! Your instructor account is ready.'
          : 'Request submitted! We\'ll review it within 1-2 business days.'
      );

    } catch (error) {
      console.error('Error becoming instructor:', error);
      toast.error('Failed to submit request. Please try again.');
      setStep('info');
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignInstructorRole = async () => {
    // Check if role already exists
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user?.id)
      .eq('role', 'instructor')
      .single();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user?.id,
          role: 'instructor',
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        console.error('Error assigning role:', roleError);
        throw new Error('Failed to assign instructor role');
      }
    }
  };

  const stepProgress = {
    info: 50,
    processing: 80,
    complete: 100,
  };

  return (
    <AppShell>
      <PageContainer>
        <div className="max-w-xl mx-auto space-y-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => navigate('/teach')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Teach
          </Button>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
              <School className="h-4 w-4" />
              Instructor Application
            </div>
            <h1 className="text-2xl font-bold">Become an Instructor</h1>
            <p className="text-muted-foreground">
              {step === 'complete'
                ? 'Your application has been submitted'
                : 'Complete this quick form to start creating courses'}
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
                ) : step === 'processing' ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
                {step === 'complete'
                  ? autoApproved ? 'Welcome, Instructor!' : 'Application Submitted'
                  : step === 'processing'
                  ? 'Processing...'
                  : 'Your Information'}
              </CardTitle>
              <CardDescription>
                {step === 'complete'
                  ? autoApproved
                    ? 'Your instructor account is ready to use'
                    : 'We\'ll notify you by email once approved'
                  : step === 'processing'
                  ? 'Setting up your instructor account...'
                  : '.edu emails are automatically verified'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* ============ COMPLETE STATE ============ */}
              {step === 'complete' && (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <h3 className="text-lg font-semibold">
                      {autoApproved ? 'You\'re All Set!' : 'Request Received!'}
                    </h3>
                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                      {autoApproved
                        ? 'You can now create and manage courses. Start by creating your first course!'
                        : 'We\'ll review your application and notify you by email within 1-2 business days.'}
                    </p>
                  </div>

                  {/* Status Summary */}
                  <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium">{formData.email}</span>
                    </div>
                    {formData.institution && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Institution</span>
                        <span className="font-medium">{formData.institution}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={autoApproved ? 'default' : 'secondary'}>
                        {autoApproved ? 'Approved' : 'Pending Review'}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate('/teach')}
                    >
                      Go to Dashboard
                    </Button>
                    {autoApproved && (
                      <Button
                        className="flex-1 gap-2"
                        onClick={() => navigate('/instructor/quick-setup')}
                      >
                        Create Course
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* ============ PROCESSING STATE ============ */}
              {step === 'processing' && (
                <div className="flex flex-col items-center py-8 gap-4">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-muted-foreground">Setting up your instructor account...</p>
                </div>
              )}

              {/* ============ INFO FORM STATE ============ */}
              {step === 'info' && (
                <div className="space-y-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange('email')}
                        placeholder="your.email@university.edu"
                        className="pl-10"
                      />
                      {isEduEmail && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                      )}
                    </div>
                    {isEduEmail ? (
                      <p className="text-xs text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        .edu email detected - you'll be automatically approved!
                      </p>
                    ) : formData.email && (
                      <p className="text-xs text-muted-foreground">
                        Non-.edu emails require manual review (1-2 business days)
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Institution */}
                  <div className="space-y-2">
                    <Label htmlFor="institution">
                      Institution
                      <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="institution"
                        value={formData.institution}
                        onChange={handleInputChange('institution')}
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
                        onChange={handleInputChange('department')}
                        placeholder="Computer Science"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={handleInputChange('title')}
                        placeholder="Professor"
                      />
                    </div>
                  </div>

                  {/* LinkedIn */}
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">
                      LinkedIn Profile
                      <span className="text-muted-foreground font-normal ml-1">(speeds up review)</span>
                    </Label>
                    <div className="relative">
                      <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="linkedin"
                        value={formData.linkedinUrl}
                        onChange={handleInputChange('linkedinUrl')}
                        placeholder="https://linkedin.com/in/yourprofile"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!formData.email || isSubmitting}
                  >
                    {isEduEmail ? (
                      <>
                        <GraduationCap className="h-4 w-4" />
                        Become an Instructor
                      </>
                    ) : (
                      <>
                        Submit Application
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    By continuing, you agree to our Terms of Service and Instructor Guidelines.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Benefits reminder */}
          {step === 'info' && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <School className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">What you'll get</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                      <li>• AI-powered course creation from syllabi</li>
                      <li>• Student progress tracking</li>
                      <li>• Issue verifiable completion certificates</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
