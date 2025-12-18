import { useState } from "react";
import { AppShell } from "@/components/layout";
import { GapAnalysisView } from "@/components/analysis";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDreamJobs } from "@/hooks/useDreamJobs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";

export default function AnalysisPage() {
  const { data: dreamJobs = [], isLoading } = useDreamJobs();
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  // Auto-select first job if available
  const activeJobId = selectedJobId || dreamJobs[0]?.id || "";
  const selectedJob = dreamJobs.find(j => j.id === activeJobId);

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (dreamJobs.length === 0) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Gap Analysis</h2>
            <p className="text-muted-foreground">
              Analyze the gap between your skills and dream job requirements
            </p>
          </div>
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-accent/10">
                <BarChart3 className="h-8 w-8 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No dream jobs to analyze</h3>
                <p className="text-muted-foreground">
                  Add a dream job first to see your gap analysis
                </p>
              </div>
              <Button onClick={() => window.location.href = '/dream-jobs'}>
                Add Dream Job
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Job Selector */}
        {dreamJobs.length > 1 && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Analyzing for:</span>
            <Select value={activeJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a dream job" />
              </SelectTrigger>
              <SelectContent>
                {dreamJobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <GapAnalysisView 
          dreamJobId={activeJobId}
          dreamJobTitle={selectedJob?.title || "Dream Job"}
        />
      </div>
    </AppShell>
  );
}
