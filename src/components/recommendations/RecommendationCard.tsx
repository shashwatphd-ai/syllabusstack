import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Video, 
  Code, 
  Users, 
  ExternalLink,
  Clock,
  Star,
  CheckCircle2
} from "lucide-react";

type RecommendationType = "course" | "project" | "certification" | "networking" | "resource";
type Priority = "high" | "medium" | "low";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: RecommendationType;
  priority: Priority;
  estimatedTime: string;
  provider?: string;
  url?: string;
  isCompleted: boolean;
  relatedGap: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onComplete?: (id: string) => void;
  onView?: (id: string) => void;
}

const getTypeIcon = (type: RecommendationType) => {
  switch (type) {
    case "course":
      return <BookOpen className="h-5 w-5" />;
    case "project":
      return <Code className="h-5 w-5" />;
    case "certification":
      return <Star className="h-5 w-5" />;
    case "networking":
      return <Users className="h-5 w-5" />;
    case "resource":
      return <Video className="h-5 w-5" />;
  }
};

const getPriorityColor = (priority: Priority): string => {
  switch (priority) {
    case "high":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "medium":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "low":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  }
};

export function RecommendationCard({ recommendation, onComplete, onView }: RecommendationCardProps) {
  const { id, title, description, type, priority, estimatedTime, provider, url, isCompleted, relatedGap } = recommendation;

  return (
    <Card className={`transition-all ${isCompleted ? "opacity-60" : "hover:shadow-md"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isCompleted ? "bg-green-500/10" : "bg-accent/10"}`}>
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <span className="text-accent">{getTypeIcon(type)}</span>
              )}
            </div>
            <div>
              <CardTitle className={`text-base ${isCompleted ? "line-through" : ""}`}>
                {title}
              </CardTitle>
              {provider && (
                <p className="text-xs text-muted-foreground">{provider}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={getPriorityColor(priority)}>
            {priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {estimatedTime}
          </span>
          <span className="capitalize">{type}</span>
        </div>

        <div className="text-xs">
          <span className="text-muted-foreground">Addresses: </span>
          <Badge variant="secondary" className="text-xs">
            {relatedGap}
          </Badge>
        </div>

        <div className="flex items-center gap-2 pt-2">
          {!isCompleted && (
            <Button size="sm" onClick={() => onComplete?.(id)}>
              Mark Complete
            </Button>
          )}
          {url && (
            <Button size="sm" variant="outline" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Resource
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Mock recommendations for demo
export const mockRecommendations: Recommendation[] = [
  {
    id: "1",
    title: "Machine Learning Specialization",
    description: "Comprehensive course covering ML fundamentals, neural networks, and practical applications with hands-on projects.",
    type: "course",
    priority: "high",
    estimatedTime: "3 months",
    provider: "Coursera - Andrew Ng",
    url: "https://coursera.org",
    isCompleted: false,
    relatedGap: "Machine Learning",
  },
  {
    id: "2",
    title: "Build End-to-End ML Pipeline Project",
    description: "Create a complete ML project from data collection to deployment. Include data preprocessing, model training, and API deployment.",
    type: "project",
    priority: "high",
    estimatedTime: "4-6 weeks",
    isCompleted: false,
    relatedGap: "Real-world Experience",
  },
  {
    id: "3",
    title: "Advanced SQL for Data Analysis",
    description: "Master complex queries, window functions, CTEs, and query optimization techniques.",
    type: "course",
    priority: "high",
    estimatedTime: "4 weeks",
    provider: "DataCamp",
    url: "https://datacamp.com",
    isCompleted: false,
    relatedGap: "SQL & Database",
  },
  {
    id: "4",
    title: "AWS Cloud Practitioner Certification",
    description: "Get certified in cloud fundamentals to demonstrate familiarity with AWS services.",
    type: "certification",
    priority: "medium",
    estimatedTime: "6 weeks",
    provider: "AWS",
    url: "https://aws.amazon.com/certification",
    isCompleted: false,
    relatedGap: "Cloud Platforms",
  },
  {
    id: "5",
    title: "Join Data Science Community",
    description: "Attend local meetups and join online communities to network with professionals and learn from their experiences.",
    type: "networking",
    priority: "medium",
    estimatedTime: "Ongoing",
    isCompleted: true,
    relatedGap: "Professional Network",
  },
];
