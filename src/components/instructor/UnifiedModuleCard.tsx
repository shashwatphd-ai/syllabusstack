import { useState, useMemo } from 'react';
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

  // Memoize loIds to prevent refetch on every render (was creating new array each render)
  const loIds = useMemo(() => learningObjectives.map(lo => lo.id), [learningObjectives]);
  const { data: loContentStatus } = useLOContentStatus(loIds);

  // Calculate module stats - single pass
  const { losWithContent, losWithPending, losWithoutContent, losCovered } = useMemo(() => {
    let withContent = 0;
    let withPending = 0;
    let withoutContent = 0;
    
    for (const lo of learningObjectives) {
      const status = loContentStatus?.[lo.id];
      if (status?.approvedCount) withContent++;
      else if (status?.pendingCount) withPending++;
      else if (!status?.hasContent) withoutContent++;
    }
    
    return { 
      losWithContent: withContent, 
      losWithPending: withPending, 
      losWithoutContent: withoutContent,
      losCovered: withContent + withPending,
    };
  }, [learningObjectives, loContentStatus]);

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

  // Fetch existing questions lazily during quiz generation (cannot call hooks in a loop)
  const fetchExistingQuestions = async (loId: string): Promise<string[]> => {
    try {
      const { data } = await (await import('@/integrations/supabase/client')).supabase
        .from('assessment_questions')
        .select('question_text')
        .eq('learning_objective_id', loId);
      return data?.map(q => q.question_text).filter(Boolean) as string[] || [];
    } catch { return []; }
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
        const existingTexts = await fetchExistingQuestions(lo.id);
        try {
          const result = await generateQuestions.mutateAsync({
            learningObjectiveId: lo.id,
            learningObjectiveText: lo.text,
            existingQuestions: existingTexts.length > 0 ? existingTexts : undefined,
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
                    {losCovered > 0 && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs shrink-0 ${
                          losWithContent === learningObjectives.length 
                            ? 'text-success border-success/30' 
                            : 'text-muted-foreground border-border'
                        }`}
                      >
                        {losWithContent}/{learningObjectives.length} content ready
                        {losWithPending > 0 && ` · ${losWithPending} to review`}
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
                        <span className="sm:hidden">...</span>
                      </>
                    ) : quizGenerated ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        <span className="hidden sm:inline">Generated!</span>
                        <span className="sm:hidden">Done</span>
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
                        <span className="sm:hidden">...</span>
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
            <p className="text-xs sm:text-sm text-muted-foreground ml-7 mt-1">{module.description}</p>
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
