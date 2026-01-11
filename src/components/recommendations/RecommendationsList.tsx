import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RecommendationCard } from "./RecommendationCard";
import { ReAnalysisPrompt } from "./ReAnalysisPrompt";
import { ProgressTracker } from "./ProgressTracker";
import { useRecommendations, useUpdateRecommendationStatus } from "@/hooks/useRecommendations";
import { performGapAnalysis } from "@/services";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Loader2 } from "lucide-react";

type FilterType = "all" | "course" | "project" | "certification" | "skill" | "experience" | "action" | "reading" | "networking" | "portfolio" | "resource";

interface RecommendationsListProps {
  dreamJobId?: string;
  freeFirst?: boolean;
  priceFilter?: 'all' | 'free' | 'paid';
}

export function RecommendationsList({ dreamJobId, freeFirst = false, priceFilter = 'all' }: RecommendationsListProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [showReAnalysisPrompt, setShowReAnalysisPrompt] = useState(false);
  const [isReAnalyzing, setIsReAnalyzing] = useState(false);
  const previousCompletedCount = useRef(0);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: recommendations = [], isLoading } = useRecommendations(dreamJobId);
  const updateStatus = useUpdateRecommendationStatus();

  // Apply type filter first
  const typeFilteredRecs = filter === "all" 
    ? recommendations 
    : recommendations.filter((r) => r.type === filter);
  
  // Apply price filter for courses
  const priceFilteredRecs = typeFilteredRecs.filter(rec => {
    if (rec.type !== 'course') return true; // non-courses pass through
    if (priceFilter === 'free') return rec.cost_usd === 0 || rec.cost_usd === null;
    if (priceFilter === 'paid') return rec.cost_usd !== null && rec.cost_usd > 0;
    return true; // 'all'
  });
  
  // Apply freeFirst sorting for courses
  const filteredRecommendations = freeFirst 
    ? [...priceFilteredRecs].sort((a, b) => {
        // Only sort courses, keep other types in place
        if (a.type === 'course' && b.type === 'course') {
          const aFree = a.cost_usd === 0 || a.cost_usd === null;
          const bFree = b.cost_usd === 0 || b.cost_usd === null;
          if (aFree && !bFree) return -1;
          if (!aFree && bFree) return 1;
        }
        return 0;
      })
    : priceFilteredRecs;

  const pendingCount = recommendations.filter((r) => r.status !== 'completed' && r.status !== 'skipped').length;
  const completedCount = recommendations.filter((r) => r.status === 'completed').length;

  const handleStatusChange = async (id: string, status: 'pending' | 'in_progress' | 'completed' | 'skipped') => {
    const previousStatus = recommendations.find(r => r.id === id)?.status;
    
    await updateStatus.mutateAsync({ id, status });
    
    // If marking as completed and this increases the completed count, show re-analysis prompt
    if (status === 'completed' && previousStatus !== 'completed') {
      // Check if we should prompt for re-analysis (after completing any recommendation)
      const newCompletedCount = completedCount + 1;
      
      // Show prompt after completing 1, 3, 5, etc. recommendations (odd milestones)
      // Or when completing the first one
      if (newCompletedCount === 1 || (newCompletedCount >= 3 && newCompletedCount % 2 === 1)) {
        previousCompletedCount.current = newCompletedCount;
        setShowReAnalysisPrompt(true);
      }
    }
  };

  const handleReAnalysis = async () => {
    if (!dreamJobId) {
      setShowReAnalysisPrompt(false);
      return;
    }
    
    setIsReAnalyzing(true);
    try {
      await performGapAnalysis(dreamJobId);
      queryClient.invalidateQueries({ queryKey: queryKeys.gapAnalysis(dreamJobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobDetail(dreamJobId) });
      
      toast({
        title: "Analysis Updated! 🎉",
        description: "Your match score has been recalculated based on your progress.",
      });
      
      setShowReAnalysisPrompt(false);
      
      // Navigate to the assessment tab to show the updated score
      // The user is already on the dream job page, so we just close the dialog
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to re-run analysis",
        variant: "destructive",
      });
    } finally {
      setIsReAnalyzing(false);
    }
  };

  const handleSkipReAnalysis = () => {
    setShowReAnalysisPrompt(false);
    toast({
      title: "Keep going!",
      description: "You can re-run your analysis anytime from the Assessment tab.",
    });
  };

  // Transform database recommendations to component format
  const transformedRecs = filteredRecommendations.map(rec => ({
    id: rec.id,
    title: rec.title,
    description: rec.description || '',
    type: (rec.type as "course" | "project" | "certification" | "action" | "reading" | "skill" | "experience" | "resource" | "networking" | "portfolio") || 'resource',
    priority: (rec.priority as "high" | "medium" | "low" | "critical" | "important" | "nice_to_have") || 'medium',
    estimatedTime: rec.duration || undefined,
    effort_hours: rec.effort_hours,
    cost_usd: rec.cost_usd,
    provider: rec.provider || undefined,
    url: rec.url || undefined,
    status: (rec.status as "pending" | "in_progress" | "completed" | "skipped" | "not_started") || 'pending',
    relatedGap: rec.gap_addressed || undefined,
    gap_addressed: rec.gap_addressed || undefined,
    why_this_matters: rec.why_this_matters,
    steps: rec.steps as any[],
    evidence_created: rec.evidence_created,
    how_to_demonstrate: rec.how_to_demonstrate,
    // Add linked course fields
    linked_course_id: rec.linked_course_id,
    linked_course_title: rec.linked_course_title,
    enrollment_progress: rec.enrollment_progress,
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
    <>
      <ReAnalysisPrompt
        open={showReAnalysisPrompt}
        onOpenChange={setShowReAnalysisPrompt}
        onConfirm={handleReAnalysis}
        onSkip={handleSkipReAnalysis}
        completedCount={previousCompletedCount.current}
      />
      
      <div className="space-y-6">
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
            <div className="flex items-center justify-between flex-wrap gap-3">
              <TabsList>
                <TabsTrigger value="recommendations">Action Items</TabsTrigger>
                <TabsTrigger value="progress">Progress Tracker</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {pendingCount} to do
                </Badge>
                <Badge variant="secondary" className="text-xs bg-success/10 text-success border-success/30">
                  {completedCount} done
                </Badge>
              </div>
            </div>

            <TabsContent value="recommendations" className="space-y-4">
              {/* Filters - Pill style with counts */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { key: "all", label: "All", count: recommendations.length },
                  { key: "course", label: "Courses", count: recommendations.filter(r => r.type === "course").length },
                  { key: "project", label: "Projects", count: recommendations.filter(r => r.type === "project").length },
                  { key: "certification", label: "Certs", count: recommendations.filter(r => r.type === "certification").length },
                  { key: "skill", label: "Skills", count: recommendations.filter(r => r.type === "skill").length },
                  { key: "action", label: "Actions", count: recommendations.filter(r => r.type === "action").length },
                  { key: "reading", label: "Reading", count: recommendations.filter(r => r.type === "reading").length },
                  { key: "experience", label: "Experience", count: recommendations.filter(r => r.type === "experience").length },
                ].filter(item => item.key === "all" || item.count > 0).map((item) => (
                  <Button
                    key={item.key}
                    variant={filter === item.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(item.key as FilterType)}
                    className="h-7 text-xs gap-1"
                  >
                    {item.label}
                    {item.count > 0 && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                        filter === item.key ? "bg-white/20" : "bg-muted"
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {/* Single column list */}
              <div className="space-y-3">
                {transformedRecs.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>

              {filteredRecommendations.length === 0 && recommendations.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">No recommendations in this category</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="progress">
              <ProgressTracker 
                currentProgress={Math.round((completedCount / recommendations.length) * 100)}
                milestones={recommendations.slice(0, 8).map((rec) => ({
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
    </>
  );
}
