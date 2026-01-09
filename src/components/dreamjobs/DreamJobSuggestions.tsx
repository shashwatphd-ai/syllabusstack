import { useState } from 'react';
import {
  Sparkles,
  Briefcase,
  TrendingUp,
  DollarSign,
  Clock,
  Building2,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DiscoveredJob,
  useAutoDiscoverDreamJobs,
  useDiscoverDreamJobs,
  DiscoverJobsInput
} from '@/hooks/useDiscoverDreamJobs';
import { useCreateDreamJob } from '@/hooks/useDreamJobs';

interface DreamJobSuggestionsProps {
  onJobAdded?: () => void;
  showDiscoverButton?: boolean;
  compact?: boolean;
}

export function DreamJobSuggestions({
  onJobAdded,
  showDiscoverButton = true,
  compact = false
}: DreamJobSuggestionsProps) {
  const [discoveredJobs, setDiscoveredJobs] = useState<DiscoveredJob[]>([]);
  const [insights, setInsights] = useState<string>('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const autoDiscover = useAutoDiscoverDreamJobs();
  const createDreamJob = useCreateDreamJob();

  const handleDiscover = async () => {
    const result = await autoDiscover.mutateAsync();
    setDiscoveredJobs(result.jobs);
    setInsights(result.insights);
  };

  const handleAddJob = async (job: DiscoveredJob) => {
    await createDreamJob.mutateAsync({
      title: job.title,
      company_type: job.companyTypes?.[0] || null,
      location: null,
      salary_min: parseSalaryMin(job.salaryRange),
      salary_max: parseSalaryMax(job.salaryRange),
      description: job.description,
      is_primary: false,
    });
    onJobAdded?.();
  };

  const getGrowthColor = (outlook: string) => {
    const lower = outlook.toLowerCase();
    if (lower.includes('high')) return 'text-success';
    if (lower.includes('medium')) return 'text-warning';
    return 'text-muted-foreground';
  };

  if (discoveredJobs.length === 0) {
    if (!showDiscoverButton) return null;

    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Discover Career Paths</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Let AI analyze your profile and courses to suggest career paths you might not know about.
          </p>
          <Button
            onClick={handleDiscover}
            disabled={autoDiscover.isPending}
          >
            {autoDiscover.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Discover My Career Paths
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Insights Card */}
      {insights && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm mb-1">Career Insights</h4>
                <p className="text-sm text-muted-foreground">{insights}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Suggestions */}
      <div className={compact ? "space-y-2" : "grid gap-4 md:grid-cols-2"}>
        {discoveredJobs.map((job, index) => (
          <Collapsible
            key={`${job.title}-${index}`}
            open={expandedJob === job.title}
            onOpenChange={(open) => setExpandedJob(open ? job.title : null)}
          >
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CollapsibleTrigger asChild>
                  <div className="flex items-start justify-between cursor-pointer group">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 group-hover:text-primary transition-colors">
                        <Briefcase className="h-4 w-4 shrink-0" />
                        <span className="truncate">{job.title}</span>
                      </CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {job.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {expandedJob === job.title ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className="text-xs gap-1">
                    <DollarSign className="h-3 w-3" />
                    {job.salaryRange}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1 ${getGrowthColor(job.growthOutlook)}`}
                  >
                    <TrendingUp className="h-3 w-3" />
                    {job.growthOutlook.split(' ')[0]}
                  </Badge>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="pt-2 space-y-4">
                  {/* Why It Fits */}
                  <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                    <h5 className="text-xs font-medium text-success uppercase tracking-wide mb-1">
                      Why This Fits You
                    </h5>
                    <p className="text-sm">{job.whyItFits}</p>
                  </div>

                  {/* Day in Life */}
                  {job.dayInLife && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        A Day in This Role
                      </h5>
                      <p className="text-sm text-muted-foreground">{job.dayInLife}</p>
                    </div>
                  )}

                  {/* Key Skills */}
                  {job.keySkills?.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Key Skills
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {job.keySkills.map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Company Types */}
                  {job.companyTypes?.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Where to Find This Role
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {job.companyTypes.map((type, i) => (
                          <Badge key={i} variant="outline" className="text-xs capitalize">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Button */}
                  <Button
                    className="w-full"
                    onClick={() => handleAddJob(job)}
                    disabled={createDreamJob.isPending}
                  >
                    {createDreamJob.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add to My Dream Jobs
                      </>
                    )}
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      {/* Discover More Button */}
      {showDiscoverButton && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleDiscover}
            disabled={autoDiscover.isPending}
          >
            {autoDiscover.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Discover More Careers
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper functions to parse salary range
function parseSalaryMin(salaryRange: string): number | null {
  const match = salaryRange.match(/\$(\d+)/);
  if (match) {
    const value = parseInt(match[1], 10);
    return value > 1000 ? value : value * 1000; // Handle K notation
  }
  return null;
}

function parseSalaryMax(salaryRange: string): number | null {
  const matches = salaryRange.match(/\$(\d+)/g);
  if (matches && matches.length >= 2) {
    const value = parseInt(matches[1].replace('$', ''), 10);
    return value > 1000 ? value : value * 1000;
  }
  return null;
}

// Compact version for sidebars or smaller spaces
export function DreamJobSuggestionsCompact(props: Omit<DreamJobSuggestionsProps, 'compact'>) {
  return <DreamJobSuggestions {...props} compact />;
}
