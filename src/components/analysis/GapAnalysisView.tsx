import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HonestAssessment } from "./HonestAssessment";
import { GapsList } from "./GapsList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  BarChart3
} from "lucide-react";

interface GapAnalysisViewProps {
  dreamJobId?: string;
  dreamJobTitle?: string;
  isLoading?: boolean;
}

export function GapAnalysisView({ 
  dreamJobId, 
  dreamJobTitle = "Data Scientist",
  isLoading 
}: GapAnalysisViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gap Analysis</h2>
          <p className="text-muted-foreground">
            Detailed analysis for {dreamJobTitle}
          </p>
        </div>
        <Badge variant="outline" className="text-base px-4 py-2">
          <Target className="h-4 w-4 mr-2" />
          68% Ready
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">18</p>
                <p className="text-sm text-muted-foreground">Skills Aligned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Gaps Identified</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent/10">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">3-6 mo</p>
                <p className="text-sm text-muted-foreground">Est. Time to Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assessment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assessment">Honest Assessment</TabsTrigger>
          <TabsTrigger value="gaps">Skill Gaps</TabsTrigger>
          <TabsTrigger value="comparison">Skills Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment">
          <HonestAssessment isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="gaps">
          <GapsList isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="comparison">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Skills Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { skill: "Python", current: 75, required: 80 },
                  { skill: "Machine Learning", current: 30, required: 70 },
                  { skill: "SQL", current: 45, required: 80 },
                  { skill: "Statistics", current: 65, required: 70 },
                  { skill: "Data Visualization", current: 70, required: 65 },
                  { skill: "Communication", current: 50, required: 75 },
                ].map((item) => (
                  <div key={item.skill} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.skill}</span>
                      <span className={item.current >= item.required ? "text-green-500" : "text-yellow-500"}>
                        {item.current}% / {item.required}%
                      </span>
                    </div>
                    <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="absolute h-full bg-muted-foreground/20 rounded-full"
                        style={{ width: `${item.required}%` }}
                      />
                      <div
                        className={`absolute h-full rounded-full ${
                          item.current >= item.required ? "bg-green-500" : "bg-accent"
                        }`}
                        style={{ width: `${item.current}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
