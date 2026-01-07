import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Sparkles, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LearningObjective, useSearchYouTubeContent } from '@/hooks/useLearningObjectives';
import { useLOContentStatus } from '@/hooks/useContentStats';
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
  const searchContent = useSearchYouTubeContent();

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
                {losWithContent > 0 && (
                  <Badge variant="outline" className="text-xs text-success border-success/30">
                    {losWithContent} ready
                  </Badge>
                )}
                {losWithPending > 0 && (
                  <Badge variant="outline" className="text-xs text-warning border-warning/30">
                    {losWithPending} pending
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {losWithoutContent > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleFindAllContent}
                    disabled={bulkSearching}
                  >
                    {bulkSearching ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Finding...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        Find All ({losWithoutContent})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          {module.description && (
            <p className="text-sm text-muted-foreground ml-8 mt-1">{module.description}</p>
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
