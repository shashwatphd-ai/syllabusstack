import { useState, useEffect } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Loader2, Plus, ArrowRight, TrendingUp, DollarSign, Briefcase, History, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-keys';
import { useCreateDreamJob } from '@/hooks/useDreamJobs';
import { useDiscoveredJobs, useAddDiscoveredToDreamJobs, DiscoveredCareer } from '@/hooks/useDiscoverDreamJobs';

interface DiscoveredJob {
  title: string;
  description: string;
  whyItFits: string;
  salaryRange: string;
  growthOutlook: string;
  keySkills: string[];
  dayInLife: string;
  companyTypes: string[];
}

interface DiscoveryInput {
  interests: string;
  skills: string;
  major: string;
  careerGoals: string;
  workStyle: string;
}

async function discoverJobs(input: DiscoveryInput): Promise<{ jobs: DiscoveredJob[]; insights: string }> {
  const { data, error } = await supabase.functions.invoke('discover-dream-jobs', {
    body: input,
  });

  if (error) throw error;
  if (data.error) throw new Error(data.error);

  return { jobs: data.jobs || [], insights: data.insights || '' };
}

interface DreamJobDiscoveryProps {
  onJobAdded?: () => void;
}

export function DreamJobDiscovery({ onJobAdded }: DreamJobDiscoveryProps) {
  const [discoveredJobs, setDiscoveredJobs] = useState<DiscoveredJob[]>([]);
  const [insights, setInsights] = useState('');
  const [addingJob, setAddingJob] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createDreamJob = useCreateDreamJob();

  // Fetch previously discovered careers from database
  const { data: previouslyDiscovered = [], isLoading: loadingPrevious } = useDiscoveredJobs();
  const addDiscoveredToDreamJobs = useAddDiscoveredToDreamJobs();

  const discoverMutation = useMutation({
    mutationFn: discoverJobs,
    onSuccess: (data) => {
      setDiscoveredJobs(data.jobs);
      setInsights(data.insights);
      toast({
        title: `Discovered ${data.jobs.length} career paths!`,
        description: "Review these options and add any that interest you.",
      });
    },
    onError: (error) => {
      toast({
        title: "Discovery failed",
        description: error instanceof Error ? error.message : "Failed to discover jobs",
        variant: "destructive",
      });
    },
  });

  const form = useForm({
    defaultValues: {
      interests: '',
      skills: '',
      major: '',
      careerGoals: '',
      workStyle: '',
    },
    onSubmit: async ({ value }) => {
      discoverMutation.mutate(value);
    },
  });

  const handleAddJob = async (job: DiscoveredJob) => {
    setAddingJob(job.title);
    try {
      await createDreamJob.mutateAsync({
        title: job.title,
        description: job.description,
        company_type: job.companyTypes?.[0] || null,
        salary_range: job.salaryRange,
      });
      
      toast({
        title: "Dream job added!",
        description: `${job.title} has been added to your dream jobs.`,
      });
      
      // Remove from discovered list
      setDiscoveredJobs(prev => prev.filter(j => j.title !== job.title));
      onJobAdded?.();
    } catch (error) {
      toast({
        title: "Failed to add job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAddingJob(null);
    }
  };

  const handleAddPreviouslyDiscovered = async (career: DiscoveredCareer) => {
    setAddingJob(career.id);
    try {
      await addDiscoveredToDreamJobs.mutateAsync(career);
      onJobAdded?.();
    } finally {
      setAddingJob(null);
    }
  };

  const getGrowthColor = (outlook: string): string => {
    if (outlook.toLowerCase().includes('high')) return 'text-green-500';
    if (outlook.toLowerCase().includes('medium')) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  // Filter out careers already added to dream jobs
  const availablePreviousDiscoveries = previouslyDiscovered.filter(c => !c.is_added_to_dream_jobs);

  return (
    <div className="space-y-6">
      {/* Discovery Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Discover Your Dream Career
          </CardTitle>
          <CardDescription>
            Tell us about yourself and our AI will suggest careers you might not even know exist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <form.Field name="interests">
                {(field) => (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">What interests you?</label>
                    <Textarea
                      placeholder="e.g., solving puzzles, working with data, creative projects, helping people..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="skills">
                {(field) => (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your skills & strengths</label>
                    <Textarea
                      placeholder="e.g., analytical thinking, communication, coding, design..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="major">
                {(field) => (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Major / Field of Study</label>
                    <Input
                      placeholder="e.g., Computer Science, Business, Psychology..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="workStyle">
                {(field) => (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preferred work style</label>
                    <Input
                      placeholder="e.g., remote, collaborative, independent, fast-paced..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>
            </div>

            <form.Field name="careerGoals">
              {(field) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Career goals (optional)</label>
                  <Textarea
                    placeholder="e.g., I want to make an impact, earn well, have work-life balance, lead teams..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </form.Field>

            <Button 
              type="submit" 
              disabled={discoverMutation.isPending}
              className="w-full"
            >
              {discoverMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Discovering careers...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Discover Career Paths
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Insights */}
      {insights && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-4">
            <p className="text-sm">{insights}</p>
          </CardContent>
        </Card>
      )}

      {/* Discovered Jobs */}
      {discoveredJobs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Discovered Career Paths</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {discoveredJobs.map((job, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{job.title}</CardTitle>
                      <CardDescription className="mt-1">{job.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-green-500" />
                      {job.salaryRange}
                    </span>
                    <span className={`flex items-center gap-1 ${getGrowthColor(job.growthOutlook)}`}>
                      <TrendingUp className="h-3 w-3" />
                      {job.growthOutlook.split(' ')[0]}
                    </span>
                  </div>

                  <div className="p-2 rounded-md bg-muted/50 text-sm">
                    <strong>Why it fits:</strong> {job.whyItFits}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {job.keySkills.slice(0, 4).map((skill, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    {job.companyTypes.join(', ')}
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleAddJob(job)}
                    disabled={addingJob === job.title}
                  >
                    {addingJob === job.title ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Dream Jobs
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Previously Discovered Careers from Database */}
      {availablePreviousDiscoveries.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Previously Discovered Careers
          </h3>
          <p className="text-sm text-muted-foreground">
            These careers were discovered in your previous sessions
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {availablePreviousDiscoveries.map((career) => (
              <Card key={career.id} className="hover:shadow-md transition-shadow border-muted">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{career.title}</CardTitle>
                      <CardDescription className="mt-1">{career.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    {career.salary_range && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-green-500" />
                        {career.salary_range}
                      </span>
                    )}
                    {career.growth_outlook && (
                      <span className={`flex items-center gap-1 ${getGrowthColor(career.growth_outlook)}`}>
                        <TrendingUp className="h-3 w-3" />
                        {career.growth_outlook.split(' ')[0]}
                      </span>
                    )}
                  </div>

                  {career.why_it_fits && (
                    <div className="p-2 rounded-md bg-muted/50 text-sm">
                      <strong>Why it fits:</strong> {career.why_it_fits}
                    </div>
                  )}

                  {career.key_skills && career.key_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {career.key_skills.slice(0, 4).map((skill, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {career.company_types && career.company_types.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Briefcase className="h-3 w-3" />
                      {career.company_types.join(', ')}
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleAddPreviouslyDiscovered(career)}
                    disabled={addingJob === career.id}
                  >
                    {addingJob === career.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Dream Jobs
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Show message if no discoveries */}
      {discoveredJobs.length === 0 && availablePreviousDiscoveries.length === 0 && !discoverMutation.isPending && (
        <Card className="p-8 text-center border-dashed">
          <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            Fill out the form above to discover career paths tailored to your interests and skills
          </p>
        </Card>
      )}
    </div>
  );
}
