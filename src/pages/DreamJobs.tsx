import { useState } from "react";
import { AppShell } from "@/components/layout";
import { DreamJobSelector } from "@/components/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  MapPin, 
  DollarSign,
  MoreVertical,
  Trash2,
  BarChart3,
  Plus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

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

export default function DreamJobsPage() {
  const [jobs, setJobs] = useState(mockJobs);
  const [showSelector, setShowSelector] = useState(false);
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Dream Jobs</h1>
            <p className="text-muted-foreground">
              Track your career aspirations
            </p>
          </div>
          <Button onClick={() => setShowSelector(!showSelector)}>
            {showSelector ? "View Jobs" : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Dream Job
              </>
            )}
          </Button>
        </div>

        {showSelector ? (
          <DreamJobSelector />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <Card 
                key={job.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate("/analysis")}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <Target className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{job.title}</CardTitle>
                        {job.company && (
                          <p className="text-xs text-muted-foreground">{job.company}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate("/analysis");
                        }}>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          View Analysis
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                      <span>Match Score</span>
                      <span className={`font-semibold ${
                        job.matchScore >= 80 ? "text-green-500" :
                        job.matchScore >= 60 ? "text-accent" : "text-yellow-500"
                      }`}>
                        {job.matchScore}%
                      </span>
                    </div>
                    <Progress value={job.matchScore} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <Badge variant={job.status === "active" ? "default" : "secondary"}>
                      {job.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {job.gapsCount} gaps
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
