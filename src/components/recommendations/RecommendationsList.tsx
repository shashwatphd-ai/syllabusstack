import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RecommendationCard
} from "./RecommendationCard";
import { ProgressTracker } from "./ProgressTracker";
import { useRecommendations, useUpdateRecommendationStatus } from "@/hooks/useRecommendations";
import { Lightbulb } from "lucide-react";

type FilterType = "all" | "course" | "project" | "certification" | "skill" | "experience";

interface RecommendationsListProps {
  dreamJobId?: string;
}

export function RecommendationsList({ dreamJobId }: RecommendationsListProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const { data: recommendations = [], isLoading } = useRecommendations(dreamJobId);
  const updateStatus = useUpdateRecommendationStatus();

  const filteredRecommendations = filter === "all" 
    ? recommendations 
    : recommendations.filter((r) => r.type === filter);

  const pendingCount = recommendations.filter((r) => r.status !== 'completed').length;
  const completedCount = recommendations.filter((r) => r.status === 'completed').length;

  const handleStatusChange = async (id: string, status: 'pending' | 'in_progress' | 'completed' | 'skipped') => {
    await updateStatus.mutateAsync({ id, status });
  };

  // Transform database recommendations to component format
  const transformedRecs = filteredRecommendations.map(rec => ({
    id: rec.id,
    title: rec.title,
    description: rec.description || '',
    type: (rec.type as "course" | "project" | "certification" | "action" | "reading" | "skill" | "experience" | "resource" | "networking") || 'resource',
    priority: (rec.priority as "high" | "medium" | "low" | "critical" | "important" | "nice_to_have") || 'medium',
    estimatedTime: rec.duration || 'Varies',
    effort_hours: rec.effort_hours,
    cost_usd: rec.cost_usd,
    provider: rec.provider || undefined,
    url: rec.url || undefined,
    status: (rec.status as "pending" | "in_progress" | "completed" | "skipped" | "not_started") || 'pending',
    relatedGap: rec.gap_addressed || 'Skill Gap',
    gap_addressed: rec.gap_addressed,
    why_this_matters: rec.why_this_matters,
    steps: rec.steps as any[],
    evidence_created: rec.evidence_created,
    how_to_demonstrate: rec.how_to_demonstrate,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Recommendations</h2>
          <p className="text-muted-foreground">
            Personalized action plan to reach your dream job
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{pendingCount} pending</Badge>
          <Badge variant="secondary">{completedCount} completed</Badge>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-accent/10">
              <Lightbulb className="h-8 w-8 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No recommendations yet</h3>
              <p className="text-muted-foreground">
                Add dream jobs and run gap analysis to get personalized recommendations
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="recommendations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="recommendations">Action Items</TabsTrigger>
            <TabsTrigger value="progress">Progress Tracker</TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "course" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("course")}
              >
                Courses
              </Button>
              <Button
                variant={filter === "project" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("project")}
              >
                Projects
              </Button>
              <Button
                variant={filter === "certification" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("certification")}
              >
                Certifications
              </Button>
              <Button
                variant={filter === "skill" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("skill")}
              >
                Skills
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {transformedRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>

            {filteredRecommendations.length === 0 && recommendations.length > 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No recommendations in this category</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="progress">
            <ProgressTracker 
              currentProgress={Math.round((completedCount / recommendations.length) * 100)}
              milestones={recommendations.slice(0, 8).map((rec, i) => ({
                id: rec.id,
                title: rec.title,
                description: rec.description || '',
                isCompleted: rec.status === 'completed',
                completedDate: rec.status === 'completed' ? rec.updated_at : undefined,
              }))}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
