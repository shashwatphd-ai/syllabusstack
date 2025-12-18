import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RecommendationCard, 
  mockRecommendations 
} from "./RecommendationCard";
import { ProgressTracker } from "./ProgressTracker";
import { Filter, SortAsc } from "lucide-react";

type FilterType = "all" | "course" | "project" | "certification" | "networking" | "resource";

export function RecommendationsList() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [recommendations, setRecommendations] = useState(mockRecommendations);

  const filteredRecommendations = filter === "all" 
    ? recommendations 
    : recommendations.filter((r) => r.type === filter);

  const pendingCount = recommendations.filter((r) => !r.isCompleted).length;
  const completedCount = recommendations.filter((r) => r.isCompleted).length;

  const handleComplete = (id: string) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isCompleted: true } : r))
    );
  };

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
              variant={filter === "networking" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("networking")}
            >
              Networking
            </Button>
          </div>

          {/* Recommendations Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredRecommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onComplete={handleComplete}
              />
            ))}
          </div>

          {filteredRecommendations.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No recommendations in this category</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress">
          <ProgressTracker />
        </TabsContent>
      </Tabs>
    </div>
  );
}
