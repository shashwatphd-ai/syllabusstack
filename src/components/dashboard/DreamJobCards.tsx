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
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-accent";
  if (score >= 40) return "text-yellow-500";
  return "text-red-500";
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
        <h3 className="text-lg font-semibold">Your Dream Jobs</h3>
        <Button variant="outline" size="sm" onClick={onAddJob}>
          <Plus className="h-4 w-4 mr-2" />
          Add Job
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <Card 
            key={job.id} 
            className="hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => onViewJob?.(job.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold group-hover:text-accent transition-colors">
                    {job.title}
                  </CardTitle>
                  {job.company && (
                    <p className="text-sm text-muted-foreground">{job.company}</p>
                  )}
                </div>
                <Badge 
                  variant={job.status === "achieved" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {job.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {job.location}
                  </span>
                )}
                {job.salaryRange && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {job.salaryRange}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    Match Score
                  </span>
                  <span className={`font-semibold ${getMatchColor(job.matchScore)}`}>
                    {job.matchScore}%
                  </span>
                </div>
                <Progress value={job.matchScore} className="h-2" />
                <p className={`text-xs ${getMatchColor(job.matchScore)}`}>
                  {getMatchLabel(job.matchScore)}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {job.gapsCount} {job.gapsCount === 1 ? "gap" : "gaps"} to close
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
