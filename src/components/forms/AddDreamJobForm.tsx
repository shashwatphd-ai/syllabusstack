import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { Search, Plus, Loader2, Link2, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getFieldError, FormFieldWrapper } from '@/lib/tanstack-form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const addDreamJobSchema = z.object({
  jobQuery: z.string().min(3, 'Please enter a job title or role'),
  targetCompanyType: z.string().optional(),
  targetLocation: z.string().optional(),
});

export type AddDreamJobFormValues = z.infer<typeof addDreamJobSchema>;

interface AddDreamJobFormProps {
  onSubmit?: (data: AddDreamJobFormValues) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
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
  'Data Scientist',
  'Data Analyst',
  'Marketing Manager',
  'Business Analyst',
  'UX Designer',
  'Financial Analyst',
  'Consultant',
  'Project Manager',
  'DevOps Engineer',
  'Machine Learning Engineer',
];

export function AddDreamJobForm({ onSubmit, onCancel, isSubmitting = false }: AddDreamJobFormProps) {
  const [jobUrl, setJobUrl] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedFrom, setScrapedFrom] = useState<string | null>(null);
  
  const form = useForm({
    defaultValues: {
      jobQuery: '',
      targetCompanyType: '',
      targetLocation: '',
    },
    onSubmit: async ({ value }) => {
      const result = addDreamJobSchema.safeParse(value);
      if (!result.success) {
        return;
      }
      if (onSubmit) {
        await onSubmit(value);
      }
      form.reset();
      setJobUrl('');
      setScrapedFrom(null);
    },
  });

  const handleScrapeUrl = async () => {
    if (!jobUrl.trim()) return;
    
    setIsScrapingUrl(true);
    setScrapeError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-job-posting', {
        body: { url: jobUrl },
      });
      
      if (error) throw error;
      
      if (data.success && data.data) {
        const jobData = data.data;
        
        // Pre-fill form with scraped data
        if (jobData.title) {
          form.setFieldValue('jobQuery', jobData.title);
        }
        if (jobData.companyType) {
          const matchedType = companyTypes.find(
            t => t.value === jobData.companyType?.toLowerCase() || 
                 t.label.toLowerCase().includes(jobData.companyType?.toLowerCase())
          );
          if (matchedType) {
            form.setFieldValue('targetCompanyType', matchedType.value);
          }
        }
        if (jobData.location) {
          form.setFieldValue('targetLocation', jobData.location);
        }
        
        setScrapedFrom(data.sourceHost);
        
        toast({
          title: "Job posting imported!",
          description: `Extracted "${jobData.title}" from ${data.sourceHost}. Review and modify the details below.`,
        });
      } else {
        throw new Error(data.error || 'Failed to extract job details');
      }
    } catch (err) {
      console.error('Error scraping job URL:', err);
      setScrapeError(err instanceof Error ? err.message : 'Failed to scrape job posting');
      toast({
        title: "Couldn't import job posting",
        description: "Please try a different URL or enter the job details manually.",
        variant: "destructive",
      });
    } finally {
      setIsScrapingUrl(false);
    }
  };

  const selectPopularRole = (role: string) => {
    form.setFieldValue('jobQuery', role);
    setScrapedFrom(null);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* URL Import Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Import from job posting URL
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Paste LinkedIn, Indeed, or company job URL..."
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleScrapeUrl}
                disabled={isScrapingUrl || !jobUrl.trim()}
              >
                {isScrapingUrl ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </div>
            {scrapeError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{scrapeError}</AlertDescription>
              </Alert>
            )}
            {scrapedFrom && (
              <p className="text-xs text-muted-foreground">
                ✓ Imported from {scrapedFrom} - review and modify details below
              </p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or enter manually</span>
            </div>
          </div>

          {/* Popular Roles - only show when job query is empty */}
          <form.Subscribe selector={(state) => state.values.jobQuery}>
            {(jobQuery) => !jobQuery && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Popular roles
                </label>
                <div className="flex flex-wrap gap-2">
                  {popularRoles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                      onClick={() => selectPopularRole(role)}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </form.Subscribe>

          <form.Field
            name="jobQuery"
            validators={{
              onBlur: z.string().min(3, 'Please enter a job title or role'),
            }}
          >
            {(field) => (
              <FormFieldWrapper
                label="What role are you targeting? *"
                htmlFor="jobQuery"
                error={getFieldError(field.state.meta.errors)}
                touched={field.state.meta.isTouched}
                description="Enter any job title - our AI will analyze real requirements"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="jobQuery"
                    placeholder="e.g., Product Manager, Data Analyst, Marketing Manager"
                    className="pl-10"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              </FormFieldWrapper>
            )}
          </form.Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="targetCompanyType">
              {(field) => (
                <FormFieldWrapper
                  label="Company Type"
                  htmlFor="targetCompanyType"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <Select 
                    onValueChange={(value) => field.handleChange(value)} 
                    value={field.state.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {companyTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormFieldWrapper>
              )}
            </form.Field>

            <form.Field name="targetLocation">
              {(field) => (
                <FormFieldWrapper
                  label="Location"
                  htmlFor="targetLocation"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <Input
                    id="targetLocation"
                    placeholder="e.g., San Francisco, Remote"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormFieldWrapper>
              )}
            </form.Field>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, formIsSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting || formIsSubmitting}>
                  {(isSubmitting || formIsSubmitting) ? (
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
              )}
            </form.Subscribe>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}