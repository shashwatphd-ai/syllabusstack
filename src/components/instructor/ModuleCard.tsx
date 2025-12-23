import { useState } from 'react';
import { ChevronDown, ChevronRight, Target, Video, Search, CheckCircle2, Sparkles, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSearchYouTubeContent, LearningObjective } from '@/hooks/useLearningObjectives';
import { useGenerateAssessmentQuestions, useAssessmentQuestions } from '@/hooks/useAssessment';

interface Module {
  id: string;
  title: string;
  description: string | null;
  sequence_order: number;
}

interface ModuleCardProps {
  module: Module;
  learningObjectives: LearningObjective[];
}

export function ModuleCard({ module, learningObjectives }: ModuleCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [generatingForLO, setGeneratingForLO] = useState<string | null>(null);
  const searchContent = useSearchYouTubeContent();
  const generateQuestions = useGenerateAssessmentQuestions();

  const handleSearchContent = (lo: LearningObjective) => {
    searchContent.mutate(lo);
  };

  const handleGenerateQuestions = async (lo: LearningObjective) => {
    setGeneratingForLO(lo.id);
    try {
      await generateQuestions.mutateAsync({
        learningObjectiveId: lo.id,
        learningObjectiveText: lo.text,
      });
    } finally {
      setGeneratingForLO(null);
    }
  };

  const getBloomBadgeColor = (level: string | null) => {
    const colors: Record<string, string> = {
      remember: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      understand: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      apply: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      analyze: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      evaluate: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      create: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    };
    return colors[level || ''] || 'bg-muted text-muted-foreground';
  };

  const getVerificationBadge = (state: string) => {
    switch (state) {
      case 'verified':
        return <Badge className="bg-success/10 text-success">Verified</Badge>;
      case 'in_progress':
        return <Badge variant="outline">In Progress</Badge>;
      case 'passed':
        return <Badge className="bg-primary/10 text-primary">Passed</Badge>;
      default:
        return <Badge variant="secondary">Not Started</Badge>;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50">
        <CardHeader className="py-4">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                  {module.title}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {learningObjectives.length} LOs
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {module.description && (
                  <span className="text-sm text-muted-foreground hidden md:block">
                    {module.description}
                  </span>
                )}
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {learningObjectives.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No learning objectives yet</p>
                <p className="text-xs">Extract from syllabus to add LOs to this module</p>
              </div>
            ) : (
              <div className="space-y-3">
                {learningObjectives.map((lo) => (
                  <div 
                    key={lo.id} 
                    className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-foreground">{lo.text}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {lo.core_concept && (
                            <Badge variant="outline" className="text-xs">
                              {lo.core_concept}
                            </Badge>
                          )}
                          {lo.bloom_level && (
                            <Badge className={`text-xs ${getBloomBadgeColor(lo.bloom_level)}`}>
                              {lo.bloom_level}
                            </Badge>
                          )}
                          {lo.expected_duration_minutes && (
                            <span className="text-xs text-muted-foreground">
                              ~{lo.expected_duration_minutes} min
                            </span>
                          )}
                          {getVerificationBadge(lo.verification_state)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleSearchContent(lo)}
                          disabled={searchContent.isPending}
                        >
                          {searchContent.isPending ? (
                            <>
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <Search className="h-3 w-3" />
                              Find Content
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleGenerateQuestions(lo)}
                          disabled={generatingForLO === lo.id}
                        >
                          {generatingForLO === lo.id ? (
                            <>
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3" />
                              Generate Qs
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {lo.search_keywords && lo.search_keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {lo.search_keywords.slice(0, 3).map((keyword, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-background rounded text-muted-foreground">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
