import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  TrendingUp,
  ChevronRight,
  Plus,
  Target
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

const mockJobs: DreamJob[] = [
  {
    id: "1",
    title: "Data Scientist",
    company: "Tech Companies",
    location: "Remote / San Francisco",
    salaryRange: "$120k - $180k",
    matchScore: 68,
    gapsCount: 4,
    status: "active",
  },
  {
    id: "2",
    title: "Machine Learning Engineer",
    company: "AI Startups",
    location: "New York / Remote",
    salaryRange: "$140k - $200k",
    matchScore: 45,
    gapsCount: 7,
    status: "active",
  },
  {
    id: "3",
    title: "Product Analyst",
    company: "Product Companies",
    location: "Flexible",
    salaryRange: "$90k - $130k",
    matchScore: 82,
    gapsCount: 2,
    status: "active",
  },
];

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
  jobs = mockJobs, 
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Your Dream Jobs</h3>
        <Button variant="outline" size="sm" onClick={onAddJob} className="border-border hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors">
          <Plus className="h-4 w-4 mr-2" />
          Add Job
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job, index) => (
          <Card 
            key={job.id} 
            className="border-0 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group bg-card overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
            onClick={() => onViewJob?.(job.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold group-hover:text-accent transition-colors truncate">
                    {job.title}
                  </CardTitle>
                  {job.company && (
                    <p className="text-sm text-muted-foreground truncate">{job.company}</p>
                  )}
                </div>
                <Badge 
                  variant={job.status === "achieved" ? "default" : "secondary"}
                  className={`
                    capitalize ml-2 flex-shrink-0
                    ${job.status === "active" 
                      ? "bg-accent/10 text-accent border border-accent/20" 
                      : "bg-success/10 text-success border border-success/20"
                    }
                  `}
                >
                  {job.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {job.location && (
                  <span className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-md">
                    <MapPin className="h-3 w-3" />
                    {job.location}
                  </span>
                )}
                {job.salaryRange && (
                  <span className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-md">
                    <DollarSign className="h-3 w-3" />
                    {job.salaryRange}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Target className="h-4 w-4" />
                    Match Score
                  </span>
                  <span className={`font-bold ${getMatchColor(job.matchScore)}`}>
                    {job.matchScore}%
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${getMatchBgColor(job.matchScore)}`}
                    style={{ width: `${job.matchScore}%` }}
                  />
                </div>
                <p className={`text-xs font-medium ${getMatchColor(job.matchScore)}`}>
                  {getMatchLabel(job.matchScore)}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {job.gapsCount} {job.gapsCount === 1 ? "gap" : "gaps"} to close
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
