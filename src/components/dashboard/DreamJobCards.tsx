import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  DollarSign, 
  ChevronRight,
  Plus,
  Target,
  Briefcase
} from "lucide-react";

interface DreamJob {
  id: string;
  title: string;
  company?: string;
  location?: string;
  salaryRange?: string;
  matchScore: number;
  gapsCount: number;
  status: "active" | "achieved" | "paused";
}

interface DreamJobCardsProps {
  jobs?: DreamJob[];
  isLoading?: boolean;
  onViewJob?: (jobId: string) => void;
  onAddJob?: () => void;
}

const getMatchColor = (score: number): string => {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-accent";
  if (score >= 40) return "text-warning";
  return "text-destructive";
};

const getMatchBgColor = (score: number): string => {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-accent";
  if (score >= 40) return "bg-warning";
  return "bg-destructive";
};

const getMatchLabel = (score: number): string => {
  if (score >= 80) return "Excellent Match";
  if (score >= 60) return "Good Match";
  if (score >= 40) return "Moderate Match";
  return "Needs Work";
};

export function DreamJobCards({ 
  jobs = [], 
  isLoading, 
  onViewJob,
  onAddJob 
}: DreamJobCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-muted rounded w-3/4" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-2 bg-muted rounded w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Empty state
  if (jobs.length === 0) {
    return (
      <Card className="border-0 shadow-md h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Your Dream Jobs</CardTitle>
            <Button variant="outline" size="sm" onClick={onAddJob} className="border-border hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h4 className="font-medium text-foreground text-sm mb-1">No dream jobs yet</h4>
          <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
            Add target roles for personalized gap analysis
          </p>
          <Button size="sm" onClick={onAddJob}>
            <Plus className="h-3 w-3 mr-1" />
            Add Dream Job
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Your Dream Jobs</CardTitle>
          <Button variant="outline" size="sm" onClick={onAddJob} className="border-border hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.map((job) => (
          <div 
            key={job.id} 
            className="p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all duration-200 cursor-pointer group"
            onClick={() => onViewJob?.(job.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-sm group-hover:text-accent transition-colors truncate">
                  {job.title}
                </h4>
                {job.company && (
                  <p className="text-xs text-muted-foreground truncate">{job.company}</p>
                )}
              </div>
              <Badge 
                variant="secondary"
                className={`
                  capitalize text-xs ml-2 flex-shrink-0
                  ${job.status === "active" 
                    ? "bg-accent/10 text-accent border border-accent/20" 
                    : "bg-success/10 text-success border border-success/20"
                  }
                `}
              >
                {job.status}
              </Badge>
            </div>
            
            {(job.location || job.salaryRange) && (
              <div className="flex flex-wrap gap-1.5 mb-2 text-xs text-muted-foreground">
                {job.location && (
                  <span className="flex items-center gap-0.5 bg-muted/50 px-1.5 py-0.5 rounded">
                    <MapPin className="h-2.5 w-2.5" />
                    {job.location}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Target className="h-3 w-3" />
                  Match
                </span>
                <span className={`font-semibold ${getMatchColor(job.matchScore)}`}>
                  {job.matchScore}%
                </span>
              </div>
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getMatchBgColor(job.matchScore)}`}
                  style={{ width: `${job.matchScore}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-medium ${getMatchColor(job.matchScore)}`}>
                  {getMatchLabel(job.matchScore)}
                </p>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {job.gapsCount} gaps
                  <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
