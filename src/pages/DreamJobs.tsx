import { useState } from "react";
import { AppShell } from "@/components/layout";
import { AddDreamJobForm } from "@/components/forms";
import { DreamJobDiscovery } from "@/components/dreamjobs/DreamJobDiscovery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Target, 
  MapPin, 
  DollarSign,
  MoreVertical,
  Trash2,
  BarChart3,
  Plus,
  Briefcase,
  Sparkles
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useDreamJobs, useCreateDreamJob, useDeleteDreamJob } from "@/hooks/useDreamJobs";
import { useToast } from "@/hooks/use-toast";

export default function DreamJobsPage() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'jobs' | 'discover'>('jobs');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: jobs = [], isLoading } = useDreamJobs();
  const createDreamJob = useCreateDreamJob();
  const deleteDreamJob = useDeleteDreamJob();

  const handleAddJob = async (data: { jobQuery: string; targetCompanyType?: string; targetLocation?: string }) => {
    setIsAnalyzing(true);
    try {
      // Create dream job in database - workflow automation handles analysis
      await createDreamJob.mutateAsync({
        title: data.jobQuery,
        company_type: data.targetCompanyType || null,
        location: data.targetLocation || null,
      });

      toast({
        title: "Dream job added",
        description: "AI is analyzing requirements in the background.",
      });
      setShowForm(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add dream job",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDreamJob.mutateAsync(id);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const getMatchColor = (score: number): string => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-accent";
    if (score >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-display">Dream Jobs</h1>
              <p className="text-muted-foreground">Track your career aspirations</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-4 w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Dream Jobs</h1>
            <p className="text-muted-foreground">
              Track your career aspirations or discover new paths
            </p>
          </div>
          {activeTab === 'jobs' && (
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? "View Jobs" : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Dream Job
                </>
              )}
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'jobs' | 'discover')}>
          <TabsList>
            <TabsTrigger value="jobs" className="gap-2">
              <Briefcase className="h-4 w-4" />
              My Dream Jobs
            </TabsTrigger>
            <TabsTrigger value="discover" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Discover Careers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="mt-4">
            {showForm ? (
              <AddDreamJobForm 
                onSubmit={handleAddJob}
                onCancel={() => setShowForm(false)}
                isSubmitting={isAnalyzing}
              />
            ) : jobs.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-accent/10">
                    <Briefcase className="h-8 w-8 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">No dream jobs yet</h3>
                    <p className="text-muted-foreground">
                      Add your first dream job or discover careers you might love
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => setShowForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Dream Job
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('discover')}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Discover Careers
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {jobs.map((job) => (
              <Card 
                key={job.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/dream-jobs/${job.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <Target className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{job.title}</CardTitle>
                        {job.company_type && (
                          <p className="text-xs text-muted-foreground capitalize">{job.company_type}</p>
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
                          navigate(`/dream-jobs/${job.id}`);
                        }}>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          View Analysis
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive" 
                          onClick={(e) => handleDeleteJob(job.id, e)}
                        >
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
                    {job.salary_range && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {job.salary_range}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Match Score</span>
                      <span className={`font-semibold ${getMatchColor(job.match_score || 0)}`}>
                        {job.match_score || 0}%
                      </span>
                    </div>
                    <Progress value={job.match_score || 0} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <Badge variant={job.is_primary ? "default" : "secondary"}>
                      {job.is_primary ? "Primary" : "Active"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Added {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="discover" className="mt-4">
            <DreamJobDiscovery onJobAdded={() => setActiveTab('jobs')} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
