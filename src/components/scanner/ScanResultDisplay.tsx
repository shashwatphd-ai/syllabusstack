import { Link } from 'react-router-dom';
import { CheckCircle2, FileText, Save, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AnalysisResult {
  capabilities: string[];
  tools: { name: string; level: string }[];
  artifacts: string[];
}

interface ScanResultDisplayProps {
  courseName: string;
  result: AnalysisResult;
  onReset: () => void;
  onSave: () => void;
}

export function ScanResultDisplay({
  courseName,
  result,
  onReset,
  onSave,
}: ScanResultDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{courseName || 'Course Analysis'}</h2>
          <p className="text-sm text-muted-foreground">AI-generated capability analysis</p>
        </div>
        <Button variant="outline" onClick={onReset}>
          Scan Another
        </Button>
      </div>

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Concrete Capabilities
          </CardTitle>
          <CardDescription>
            What students will actually be able to DO after this course
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {result.capabilities.map((cap, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                  {i + 1}
                </span>
                <span className="text-sm">{cap}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Tools & Methods */}
      {result.tools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tools & Methods Proficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {result.tools.map((tool, i) => (
                <Badge key={i} variant="outline" className="py-2 px-3">
                  <span className="font-medium">{tool.name}</span>
                  <span className="text-muted-foreground ml-2">({tool.level})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Artifacts */}
      {result.artifacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evidence & Artifacts</CardTitle>
            <CardDescription>Tangible outputs students will produce</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.artifacts.map((artifact, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {artifact}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Save Results CTA */}
      <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <Save className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Save These Results</h3>
              <p className="text-sm text-muted-foreground">
                Don't lose this analysis! Create a free account to save it permanently 
                and compare against real job requirements.
              </p>
            </div>
            <Button onClick={onSave} className="shrink-0 gap-2">
              <Save className="h-4 w-4" />
              Save & Sign Up
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Full Analysis CTA */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">Want the Full Analysis?</h3>
              <p className="text-sm text-muted-foreground">
                Compare this course against real job requirements. See gaps and get 
                personalized recommendations.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/auth">
                Get Started Free
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
