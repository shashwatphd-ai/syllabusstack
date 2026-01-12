import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Sparkles, Target, FileQuestion, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LearningObjective, useSearchYouTubeContent } from '@/hooks/useLearningObjectives';
import { useLOContentStatus } from '@/hooks/useContentStats';
import { useGenerateAssessmentQuestions } from '@/hooks/useAssessment';
import { useToast } from '@/hooks/use-toast';
import { UnifiedLOCard } from './UnifiedLOCard';

interface Module {
  id: string;
  title: string;
  description: string | null;
  sequence_order: number;
}

interface UnifiedModuleCardProps {
  module: Module;
  learningObjectives: LearningObjective[];
}

export function UnifiedModuleCard({ module, learningObjectives }: UnifiedModuleCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [bulkSearching, setBulkSearching] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizGenerated, setQuizGenerated] = useState(false);
  const searchContent = useSearchYouTubeContent();
  const generateQuestions = useGenerateAssessmentQuestions();
  const { toast } = useToast();

  const loIds = learningObjectives.map(lo => lo.id);
  const { data: loContentStatus } = useLOContentStatus(loIds);

  // Calculate module stats
  const losWithContent = learningObjectives.filter(lo => loContentStatus?.[lo.id]?.approvedCount).length;
  const losWithPending = learningObjectives.filter(lo =>
    loContentStatus?.[lo.id]?.pendingCount && !loContentStatus?.[lo.id]?.approvedCount
  ).length;
  const losWithoutContent = learningObjectives.filter(lo => !loContentStatus?.[lo.id]?.hasContent).length;

  const handleFindAllContent = async () => {
    const losToSearch = learningObjectives.filter(lo => 
      !loContentStatus?.[lo.id]?.hasContent
    );
    
    if (losToSearch.length === 0) return;
    
    setBulkSearching(true);
    
    for (const lo of losToSearch) {
      try {
        await searchContent.mutateAsync(lo);
      } catch (e) {
        console.error('Error searching content for LO:', e);
      }
    }
    
    setBulkSearching(false);
  };

  // Generate quiz questions for all LOs in this module
  const handleGenerateQuiz = async () => {
    if (learningObjectives.length === 0) {
      toast({
        title: 'No learning objectives',
        description: 'Add learning objectives to this module first.',
        variant: 'destructive',
      });
      return;
    }

    setGeneratingQuiz(true);
    let totalQuestionsGenerated = 0;

    try {
      for (const lo of learningObjectives) {
        try {
          const result = await generateQuestions.mutateAsync({
            learningObjectiveId: lo.id,
            learningObjectiveText: lo.text,
          });
          totalQuestionsGenerated += result?.count || 0;
        } catch (e) {
          console.error('Error generating questions for LO:', lo.id, e);
        }
      }

      setQuizGenerated(true);
      toast({
        title: 'Quiz Generated',
        description: `Created ${totalQuestionsGenerated} questions for ${learningObjectives.length} learning objectives in "${module.title}"`,
      });

      // Reset the success indicator after 3 seconds
      setTimeout(() => setQuizGenerated(false), 3000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate quiz questions',
        variant: 'destructive',
      });
    } finally {
      setGeneratingQuiz(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50">
        <CardHeader className="py-3 sm:py-4 px-3 sm:px-6">
          <CollapsibleTrigger asChild>
            <div className="flex flex-col gap-2 cursor-pointer group">
              {/* Top row: chevron, title, LO count badge */}
              <div className="flex items-start gap-2">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-sm sm:text-base font-semibold group-hover:text-primary transition-colors">
                      {module.title}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {learningObjectives.length} LOs
                    </Badge>
                    {losWithContent > 0 && (
                      <Badge variant="outline" className="text-xs text-success border-success/30 shrink-0">
                        {losWithContent} ready
                      </Badge>
                    )}
                    {losWithPending > 0 && (
                      <Badge variant="outline" className="text-xs text-warning border-warning/30 shrink-0">
                        {losWithPending} pending
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Action buttons row - separate on mobile */}
              <div className="flex flex-wrap items-center gap-2 ml-7" onClick={(e) => e.stopPropagation()}>
                {/* Generate Quiz Button */}
                {learningObjectives.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-9 text-xs"
                    onClick={handleGenerateQuiz}
                    disabled={generatingQuiz}
                  >
                    {generatingQuiz ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="hidden sm:inline">Generating...</span>
                      </>
                    ) : quizGenerated ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        <span className="hidden sm:inline">Generated!</span>
                      </>
                    ) : (
                      <>
                        <FileQuestion className="h-3 w-3" />
                        <span className="hidden sm:inline">Generate Quiz</span>
                        <span className="sm:hidden">Quiz</span>
                      </>
                    )}
                  </Button>
                )}
                {/* Find Content Button */}
                {losWithoutContent > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-9 text-xs"
                    onClick={handleFindAllContent}
                    disabled={bulkSearching}
                  >
                    {bulkSearching ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="hidden sm:inline">Finding...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        <span className="hidden sm:inline">Find All</span> ({losWithoutContent})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          {module.description && (
            <p className="text-xs sm:text-sm text-muted-foreground ml-7 mt-1 line-clamp-2">{module.description}</p>
          )}
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
                  <UnifiedLOCard
                    key={lo.id}
                    learningObjective={lo}
                    contentStatus={loContentStatus?.[lo.id] || {
                      hasContent: false,
                      pendingCount: 0,
                      approvedCount: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
