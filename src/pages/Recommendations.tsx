import { useState } from "react";
import { AppShell } from "@/components/layout";
import { RecommendationsList, AntiRecommendations, CourseDiscovery } from "@/components/recommendations";
import { useAntiRecommendations } from "@/hooks/useRecommendations";
import { useDreamJobs } from "@/hooks/useDreamJobs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Lightbulb, GraduationCap, AlertTriangle } from "lucide-react";

export default function RecommendationsPage() {
  const { data: dreamJobs } = useDreamJobs();
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined);
  
  // Use the first/primary dream job if none selected
  const activeDreamJobId = selectedJobId || dreamJobs?.find(j => j.is_primary)?.id || dreamJobs?.[0]?.id;
  const { data: antiRecommendations, isLoading: antiLoading } = useAntiRecommendations(activeDreamJobId);
  
  const selectedJob = dreamJobs?.find(j => j.id === activeDreamJobId);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Recommendations</h1>
            <p className="text-muted-foreground">
              Your personalized roadmap to career success
            </p>
          </div>
          
          {/* Dream Job Selector */}
          {dreamJobs && dreamJobs.length > 1 && (
            <div className="flex items-center gap-3">
              <Label className="text-sm text-muted-foreground">For:</Label>
              <Select 
                value={activeDreamJobId} 
                onValueChange={(val) => setSelectedJobId(val)}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select a dream job" />
                </SelectTrigger>
                <SelectContent>
                  {dreamJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title} {job.is_primary && "(Primary)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        {/* Main Tabs */}
        <Tabs defaultValue="action-items" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="action-items" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">Action Items</span>
              <span className="sm:hidden">Actions</span>
            </TabsTrigger>
            <TabsTrigger value="courses" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">Find Courses</span>
              <span className="sm:hidden">Courses</span>
            </TabsTrigger>
            <TabsTrigger value="avoid" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">What to Avoid</span>
              <span className="sm:hidden">Avoid</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Action Items Tab */}
          <TabsContent value="action-items">
            <RecommendationsList dreamJobId={activeDreamJobId} />
          </TabsContent>
          
          {/* Courses Tab - Firecrawl Powered */}
          <TabsContent value="courses">
            <CourseDiscovery dreamJobId={activeDreamJobId} />
          </TabsContent>
          
          {/* Anti-Recommendations Tab */}
          <TabsContent value="avoid">
            {activeDreamJobId ? (
              <AntiRecommendations 
                antiRecommendations={antiRecommendations || []} 
                dreamJobTitle={selectedJob?.title}
                isLoading={antiLoading}
              />
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a dream job to see what to avoid</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
