import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Search, 
  Plus, 
  X, 
  Briefcase,
  Building2,
  MapPin,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const dreamJobSchema = z.object({
  jobQuery: z.string().min(3, 'Please enter a job title or role'),
  targetCompanyType: z.string().optional(),
  targetLocation: z.string().optional(),
});

type DreamJobFormValues = z.infer<typeof dreamJobSchema>;

interface DreamJob {
  id: string;
  jobQuery: string;
  targetCompanyType?: string;
  targetLocation?: string;
}

interface DreamJobSelectorProps {
  onJobsChange?: (jobs: DreamJob[]) => void;
  maxJobs?: number;
}

const companyTypes = [
  { value: 'startup', label: 'Startup' },
  { value: 'tech', label: 'Big Tech (FAANG)' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'finance', label: 'Finance/Banking' },
  { value: 'corporate', label: 'Fortune 500' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'agency', label: 'Agency' },
  { value: 'any', label: 'Any Company' },
];

const popularRoles = [
  'Product Manager',
  'Software Engineer',
  'Data Analyst',
  'Marketing Manager',
  'Business Analyst',
  'UX Designer',
  'Financial Analyst',
  'Consultant',
];

export function DreamJobSelector({ 
  onJobsChange, 
  maxJobs = 5 
}: DreamJobSelectorProps) {
  const [jobs, setJobs] = useState<DreamJob[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showForm, setShowForm] = useState(true);

  const form = useForm<DreamJobFormValues>({
    resolver: zodResolver(dreamJobSchema),
    defaultValues: {
      jobQuery: '',
      targetCompanyType: '',
      targetLocation: '',
    },
  });

  const addJob = async (data: DreamJobFormValues) => {
    if (jobs.length >= maxJobs) {
      toast({
        title: "Maximum reached",
        description: `You can add up to ${maxJobs} dream jobs.`,
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 1500));

      const newJob: DreamJob = {
        id: Date.now().toString(),
        jobQuery: data.jobQuery,
        targetCompanyType: data.targetCompanyType,
        targetLocation: data.targetLocation,
      };

      const updatedJobs = [...jobs, newJob];
      setJobs(updatedJobs);
      onJobsChange?.(updatedJobs);

      form.reset();
      
      toast({
        title: "Dream job added!",
        description: "AI requirements analysis will run when Lovable Cloud is enabled.",
      });

      if (updatedJobs.length >= maxJobs) {
        setShowForm(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add dream job. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const removeJob = (jobId: string) => {
    const updatedJobs = jobs.filter(j => j.id !== jobId);
    setJobs(updatedJobs);
    onJobsChange?.(updatedJobs);
    setShowForm(true);
  };

  const selectPopularRole = (role: string) => {
    form.setValue('jobQuery', role);
  };

  return (
    <div className="space-y-6">
      {/* Added Jobs */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-medium">
            Your Dream Jobs ({jobs.length}/{maxJobs})
          </label>
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{job.jobQuery}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        {job.targetCompanyType && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {companyTypes.find(c => c.value === job.targetCompanyType)?.label}
                          </span>
                        )}
                        {job.targetLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.targetLocation}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeJob(job.id)}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Job Form */}
      {showForm && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(addJob)} className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Popular Roles */}
                {!form.watch('jobQuery') && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Popular roles
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {popularRoles.map((role) => (
                        <Badge
                          key={role}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10 hover:border-primary"
                          onClick={() => selectPopularRole(role)}
                        >
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="jobQuery"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What role are you targeting? *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="e.g., Product Manager, Data Analyst, Marketing Manager"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Enter any job title - our AI will analyze real requirements
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="targetCompanyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companyTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., San Francisco, Remote"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" disabled={isAnalyzing} className="w-full">
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analyzing requirements...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Dream Job
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}

      {/* Add Another Button */}
      {!showForm && jobs.length < maxJobs && (
        <Button
          variant="outline"
          onClick={() => setShowForm(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Dream Job
        </Button>
      )}

      {/* AI Analysis Preview */}
      {jobs.length > 0 && (
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">AI Analysis Ready</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Once you complete onboarding, we'll analyze what these roles 
                  actually require and compare them to your capabilities.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
