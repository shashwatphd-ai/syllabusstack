import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  User,
  BookOpen,
  Briefcase,
  Sparkles,
  Check,
  Loader2,
  Gift,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CourseUploader, CourseData } from './CourseUploader';
import { DreamJobSelector, DreamJob } from './DreamJobSelector';
import { AIProcessingIndicator } from './AIProcessingIndicator';
import { DreamJobSuggestions } from '@/components/dreamjobs/DreamJobSuggestions';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateProfile, useCompleteOnboarding } from '@/hooks/useProfile';
import { getPendingResults, clearPendingResults } from '@/lib/pending-results';

type OnboardingStep = 'profile' | 'courses' | 'dream-jobs' | 'complete';

interface ProfileData {
  fullName: string;
  university: string;
  major: string;
  graduationYear: string;
  studentLevel: string;
}

/**
 * Storage key and helpers for onboarding form persistence
 * Task 3.2 from MASTER_IMPLEMENTATION_PLAN_V2.md
 */
const ONBOARDING_STORAGE_KEY = 'syllabusstack_onboarding_state';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SavedOnboardingState {
  profile: ProfileData;
  currentStep: OnboardingStep;
  savedAt: string;
}

function getSavedOnboardingState(): SavedOnboardingState | null {
  try {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!saved) return null;

    const parsed: SavedOnboardingState = JSON.parse(saved);

    // Check expiration
    const savedTime = new Date(parsed.savedAt).getTime();
    if (Date.now() - savedTime > MAX_AGE_MS) {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    return null;
  }
}

function saveOnboardingState(profile: ProfileData, currentStep: OnboardingStep) {
  try {
    const state: SavedOnboardingState = {
      profile,
      currentStep,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save onboarding state:', error);
  }
}

function clearOnboardingState() {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // Ignore errors when clearing
  }
}

const steps = [
  { id: 'profile', label: 'Your Profile', icon: User },
  { id: 'courses', label: 'Add Courses', icon: BookOpen },
  { id: 'dream-jobs', label: 'Dream Jobs', icon: Briefcase },
  { id: 'complete', label: 'Complete', icon: Sparkles },
];

const studentLevels = [
  { value: 'freshman', label: 'Freshman' },
  { value: 'sophomore', label: 'Sophomore' },
  { value: 'junior', label: 'Junior' },
  { value: 'senior', label: 'Senior' },
  { value: 'graduate', label: 'Graduate Student' },
];

const currentYear = new Date().getFullYear();
const graduationYears = Array.from({ length: 6 }, (_, i) => currentYear + i);

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const updateProfile = useUpdateProfile();
  const completeOnboarding = useCompleteOnboarding();
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiProcessingType, setAIProcessingType] = useState<'syllabus' | 'dreamJob' | 'gap'>('syllabus');
  const [pendingResults, setPendingResults] = useState(getPendingResults());
  const [profile, setProfile] = useState<ProfileData>(() => {
    // Initialize from saved state if available
    const saved = getSavedOnboardingState();
    return saved?.profile ?? {
      fullName: '',
      university: '',
      major: '',
      graduationYear: '',
      studentLevel: '',
    };
  });
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [dreamJobs, setDreamJobs] = useState<DreamJob[]>([]);

  // Load saved step on mount
  useEffect(() => {
    const saved = getSavedOnboardingState();
    if (saved && saved.currentStep !== 'profile') {
      // Only restore non-profile steps if profile data exists
      if (saved.profile.fullName) {
        setCurrentStep(saved.currentStep);
        toast({
          title: 'Welcome back!',
          description: 'Your progress has been restored.',
        });
      }
    }
  }, []);

  // Save state when profile or step changes
  useEffect(() => {
    // Only save if there's actual data to preserve
    if (profile.fullName || currentStep !== 'profile') {
      saveOnboardingState(profile, currentStep);
    }
  }, [profile, currentStep]);

  // Check for pending results from syllabus scanner
  useEffect(() => {
    if (pendingResults) {
      toast({
        title: 'Welcome back!',
        description: `Your "${pendingResults.courseName}" analysis is saved. Complete signup to access it.`,
      });
    }
  }, []);

  const stepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'profile':
        return profile.fullName && profile.university && profile.studentLevel;
      case 'courses':
        return courses.length > 0;
      case 'dream-jobs':
        return dreamJobs.length > 0;
      default:
        return true;
    }
  };

  const saveProfileData = async () => {
    try {
      await updateProfile.mutateAsync({
        full_name: profile.fullName,
        university: profile.university,
        major: profile.major || null,
        graduation_year: profile.graduationYear ? parseInt(profile.graduationYear) : null,
        student_level: profile.studentLevel,
      });
      return true;
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const nextStep = async () => {
    setIsSaving(true);
    
    try {
      switch (currentStep) {
        case 'profile':
          // Save profile data before moving to next step
          const saved = await saveProfileData();
          if (saved) {
            setCurrentStep('courses');
          }
          break;
        case 'courses':
          // Courses are already saved via CourseUploader
          setCurrentStep('dream-jobs');
          break;
        case 'dream-jobs':
          // Dream jobs are already saved via DreamJobSelector
          setCurrentStep('complete');
          break;
        case 'complete':
          // Mark onboarding as complete and redirect
          await completeOnboarding.mutateAsync();
          // Clear saved onboarding state on successful completion
          clearOnboardingState();
          await refreshProfile();
          toast({
            title: "Welcome to SyllabusStack!",
            description: "Your profile is set up. Let's explore your gap analysis.",
          });
          navigate('/dashboard');
          break;
      }
    } catch (error) {
      console.error('Navigation error:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const prevStep = () => {
    switch (currentStep) {
      case 'courses':
        setCurrentStep('profile');
        break;
      case 'dream-jobs':
        setCurrentStep('courses');
        break;
      case 'complete':
        setCurrentStep('dream-jobs');
        break;
    }
  };

  const handleCourseAdded = (course: CourseData) => {
    setCourses(prev => [...prev, course]);
    setIsAIProcessing(false);
  };

  const handleCourseProcessing = () => {
    setAIProcessingType('syllabus');
    setIsAIProcessing(true);
  };

  const handleDreamJobProcessing = () => {
    setAIProcessingType('dreamJob');
    setIsAIProcessing(true);
  };

  const handleDreamJobAdded = () => {
    setIsAIProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">SyllabusStack</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Step {stepIndex + 1} of {steps.length}
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Progress value={progress} className="h-2" />
          
          {/* Step Indicators */}
          <div className="flex justify-between mt-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isComplete = index < stepIndex;
              
              return (
                <div 
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2",
                    index < steps.length - 1 && "flex-1"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    isComplete && "bg-primary text-primary-foreground",
                    isActive && "bg-primary/20 text-primary border-2 border-primary",
                    !isActive && !isComplete && "bg-muted text-muted-foreground"
                  )}>
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm hidden sm:block",
                    isActive && "font-medium text-foreground",
                    !isActive && "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Profile Step */}
        {currentStep === 'profile' && (
          <Card>
            <CardHeader>
              <CardTitle>Tell us about yourself</CardTitle>
              <CardDescription>
                This helps us personalize your career analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name *</label>
                <Input
                  value={profile.fullName}
                  onChange={(e) => setProfile(p => ({ ...p, fullName: e.target.value }))}
                  placeholder="Your name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">University *</label>
                  <Input
                    value={profile.university}
                    onChange={(e) => setProfile(p => ({ ...p, university: e.target.value }))}
                    placeholder="Your university"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Major</label>
                  <Input
                    value={profile.major}
                    onChange={(e) => setProfile(p => ({ ...p, major: e.target.value }))}
                    placeholder="Your major"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Student Level *</label>
                  <Select 
                    value={profile.studentLevel}
                    onValueChange={(value) => setProfile(p => ({ ...p, studentLevel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {studentLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Graduation Year</label>
                  <Select 
                    value={profile.graduationYear}
                    onValueChange={(value) => setProfile(p => ({ ...p, graduationYear: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {graduationYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Courses Step */}
        {currentStep === 'courses' && (
          <div className="space-y-6">
            {/* Pending Results Banner */}
            {pendingResults && (
              <Card className="border-green-500/30 bg-green-50/10">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Gift className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Saved Analysis Found</p>
                      <p className="text-xs text-muted-foreground">
                        "{pendingResults.courseName}" with {pendingResults.capabilities.length} capabilities detected
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        clearPendingResults();
                        setPendingResults(null);
                        toast({ title: 'Cleared', description: 'Pending results removed.' });
                      }}
                    >
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Add your courses</CardTitle>
                <CardDescription>
                  Upload syllabi or paste content so we can analyze your capabilities.
                  You've added {courses.length} course{courses.length !== 1 ? 's' : ''}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CourseUploader 
                  onSuccess={handleCourseAdded} 
                  onProcessingStart={handleCourseProcessing}
                />
                
                {/* AI Processing Indicator */}
                <AIProcessingIndicator 
                  isProcessing={isAIProcessing && aiProcessingType === 'syllabus'} 
                  type="syllabus" 
                />
              </CardContent>
            </Card>

            {/* Added Courses List */}
            {courses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Added Courses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {courses.map((course, index) => (
                      <div 
                        key={course.id || index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{course.name}</span>
                          {course.code && (
                            <span className="text-xs text-muted-foreground">
                              ({course.code})
                            </span>
                          )}
                        </div>
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Dream Jobs Step */}
        {currentStep === 'dream-jobs' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>What roles are you targeting?</CardTitle>
                <CardDescription>
                  Get AI-powered suggestions based on your courses, or manually add your dream jobs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="suggestions" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="suggestions" className="gap-2">
                      <Lightbulb className="h-4 w-4" />
                      AI Suggestions
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="gap-2">
                      <Briefcase className="h-4 w-4" />
                      Add Manually
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="suggestions">
                    <DreamJobSuggestions
                      onJobAdded={() => {
                        // Refresh dream jobs list
                        toast({
                          title: 'Dream job added!',
                          description: 'Your gap analysis will be updated.',
                        });
                      }}
                      showDiscoverButton={true}
                    />
                  </TabsContent>
                  <TabsContent value="manual">
                    <DreamJobSelector onJobsChange={setDreamJobs} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Added Dream Jobs Counter */}
            {dreamJobs.length > 0 && (
              <Card className="border-success/30 bg-success/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                      <Check className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {dreamJobs.length} dream job{dreamJobs.length !== 1 ? 's' : ''} added
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Gap analysis will run automatically
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Complete Step */}
        {currentStep === 'complete' && (
          <Card className="text-center">
            <CardContent className="pt-8 pb-8">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                We've captured your profile, {courses.length} course{courses.length !== 1 ? 's' : ''}, 
                and {dreamJobs.length} dream job{dreamJobs.length !== 1 ? 's' : ''}. 
                Your personalized gap analysis is ready.
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-8">
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary">{courses.length}</div>
                  <div className="text-xs text-muted-foreground">Courses</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary">{dreamJobs.length}</div>
                  <div className="text-xs text-muted-foreground">Dream Jobs</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary">Ready</div>
                  <div className="text-xs text-muted-foreground">Analysis</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 'profile' || isSaving}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={nextStep}
            disabled={!canProceed() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : currentStep === 'complete' ? (
              <>
                Go to Dashboard
                <Sparkles className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}