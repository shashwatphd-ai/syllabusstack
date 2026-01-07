import { useState } from "react";
import { AppShell } from "@/components/layout";
import { RecommendationsList, AntiRecommendations } from "@/components/recommendations";
import { useAntiRecommendations } from "@/hooks/useRecommendations";
import { useDreamJobs } from "@/hooks/useDreamJobs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
        {/* Dream Job Selector */}
        {dreamJobs && dreamJobs.length > 1 && (
          <div className="flex items-center gap-4">
            <Label>Viewing recommendations for:</Label>
            <Select 
              value={activeDreamJobId} 
              onValueChange={(val) => setSelectedJobId(val)}
            >
              <SelectTrigger className="w-[280px]">
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
        
        <RecommendationsList dreamJobId={activeDreamJobId} />
        
        {/* Anti-Recommendations Section */}
        {activeDreamJobId && (
          <AntiRecommendations 
            antiRecommendations={antiRecommendations || []} 
            dreamJobTitle={selectedJob?.title}
            isLoading={antiLoading}
          />
        )}
      </div>
    </AppShell>
  );
}
