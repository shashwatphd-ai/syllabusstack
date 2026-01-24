import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Loader2, Sparkles, Target, FileQuestion, CheckCircle2, Play, Volume2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LearningObjective, useSearchYouTubeContent } from '@/hooks/useLearningObjectives';
import { useLOContentStatus } from '@/hooks/useContentStats';
import { useGenerateAssessmentQuestions } from '@/hooks/useAssessment';
import { useSubmitModuleBatchSlides, useModuleSlideStatus, useGenerateModuleAudio } from '@/hooks/useBatchSlides';
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
  instructorCourseId?: string;
}

export function UnifiedModuleCard({ module, learningObjectives, instructorCourseId }: UnifiedModuleCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [bulkSearching, setBulkSearching] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizGenerated, setQuizGenerated] = useState(false);
  const searchContent = useSearchYouTubeContent();
  const generateQuestions = useGenerateAssessmentQuestions();
  const { toast } = useToast();

  // Module-level slide generation hooks
  const submitModuleSlides = useSubmitModuleBatchSlides();
  const { data: moduleStatus, isLoading: statusLoading } = useModuleSlideStatus(module.id);
  const generateModuleAudio = useGenerateModuleAudio();

  // Determine if generation is in progress
  const isGeneratingSlides = submitModuleSlides.isPending ||
    moduleStatus?.active_batch != null ||
    (moduleStatus?.in_progress ?? 0) > 0;

  const isGeneratingAudio = generateModuleAudio.isPending ||
    moduleStatus?.module?.audio_status === 'generating';

  // Handle generate slides for module
  const handleGenerateSlides = async () => {
    if (!instructorCourseId) {
      toast({
        title: 'Error',
        description: 'Course ID not available',
        variant: 'destructive',
      });
      return;
    }

    submitModuleSlides.mutate({
      instructorCourseId,
      moduleId: module.id,
    });
  };

  // Handle generate audio for module
  const handleGenerateAudio = async () => {
    generateModuleAudio.mutate({
      moduleId: module.id,
    });
  };

  // Memoize loIds to prevent refetch on every render (was creating new array each render)
  const loIds = useMemo(() => learningObjectives.map(lo => lo.id), [learningObjectives]);
  const { data: loContentStatus } = useLOContentStatus(loIds);

  // Calculate module stats - single pass instead of 3 separate filter calls
  const { losWithContent, losWithPending, losWithoutContent } = useMemo(() => {
    let withContent = 0;
    let withPending = 0;
    let withoutContent = 0;
    
    for (const lo of learningObjectives) {
      const status = loContentStatus?.[lo.id];
      if (status?.approvedCount) withContent++;
      else if (status?.pendingCount) withPending++;
      else if (!status?.hasContent) withoutContent++;
    }
    
    return { losWithContent: withContent, losWithPending: withPending, losWithoutContent: withoutContent };
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
                {/* Generate Slides Button - Module Level */}
                {instructorCourseId && learningObjectives.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-9 text-xs"
                    onClick={handleGenerateSlides}
                    disabled={isGeneratingSlides}
                  >
                    {isGeneratingSlides ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="hidden sm:inline">
                          {moduleStatus?.active_batch
                            ? `${moduleStatus.active_batch.succeeded}/${moduleStatus.active_batch.total}`
                            : 'Generating...'}
                        </span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : moduleStatus?.ready && moduleStatus.ready > 0 ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        <span className="hidden sm:inline">{moduleStatus.ready} Slides</span>
                        <span className="sm:hidden">{moduleStatus.ready}</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        <span className="hidden sm:inline">Generate Slides</span>
                        <span className="sm:hidden">Slides</span>
                      </>
                    )}
                  </Button>
                )}
                {/* Generate Audio Button - Module Level */}
                {moduleStatus?.ready && moduleStatus.ready > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-9 text-xs"
                    onClick={handleGenerateAudio}
                    disabled={isGeneratingAudio || moduleStatus.ready === 0}
                  >
                    {isGeneratingAudio ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="hidden sm:inline">Audio...</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : moduleStatus?.audio?.with_audio && moduleStatus.audio.with_audio > 0 ? (
                      <>
                        <Volume2 className="h-3 w-3 text-success" />
                        <span className="hidden sm:inline">{moduleStatus.audio.with_audio} Audio</span>
                        <span className="sm:hidden">{moduleStatus.audio.with_audio}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Generate Audio</span>
                        <span className="sm:hidden">Audio</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
              {/* Module Generation Progress Bar */}
              {moduleStatus?.active_batch && (
                <div className="ml-7 mt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>
                      Generating: {moduleStatus.active_batch.succeeded}/{moduleStatus.active_batch.total} slides
                    </span>
                    {moduleStatus.active_batch.failed > 0 && (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {moduleStatus.active_batch.failed} failed
                      </span>
                    )}
                  </div>
                  <Progress
                    value={moduleStatus.progress_percent}
                    className="h-1.5"
                  />
                </div>
              )}
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
