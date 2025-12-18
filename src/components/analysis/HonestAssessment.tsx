import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface HonestAssessmentProps {
  dreamJobTitle: string;
  matchScore: number;
  strengths: string[];
  weaknesses: string[];
  honestFeedback: string;
  isLoading?: boolean;
}

const mockAssessment: HonestAssessmentProps = {
  dreamJobTitle: "Data Scientist",
  matchScore: 68,
  strengths: [
    "Strong foundation in Python programming",
    "Good understanding of statistical concepts",
    "Experience with data visualization",
    "Excellent problem-solving mindset",
  ],
  weaknesses: [
    "Limited machine learning project experience",
    "Need deeper SQL and database skills",
    "No exposure to cloud platforms (AWS/GCP)",
    "Communication of technical findings needs work",
  ],
  honestFeedback: "You have a solid foundation, but there's meaningful work ahead. Most entry-level Data Scientist roles expect hands-on ML experience and cloud familiarity. Your coursework has given you the theory - now you need practical projects to demonstrate real-world application. Consider focusing on 2-3 portfolio projects that showcase end-to-end data science workflows.",
};

export function HonestAssessment({ 
  dreamJobTitle = mockAssessment.dreamJobTitle,
  matchScore = mockAssessment.matchScore,
  strengths = mockAssessment.strengths,
  weaknesses = mockAssessment.weaknesses,
  honestFeedback = mockAssessment.honestFeedback,
  isLoading 
}: Partial<HonestAssessmentProps>) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-accent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-accent" />
            Honest Assessment for {dreamJobTitle}
          </CardTitle>
          <Badge variant={matchScore >= 70 ? "default" : "secondary"}>
            {matchScore}% Match
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Honest Feedback */}
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm leading-relaxed">{honestFeedback}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Your Strengths
            </h4>
            <ul className="space-y-2">
              {strengths.map((strength, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              Areas to Improve
            </h4>
            <ul className="space-y-2">
              {weaknesses.map((weakness, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-yellow-500 mt-1">•</span>
                  {weakness}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
