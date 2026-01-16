import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Filter, X, Search, ArrowLeft } from 'lucide-react';
import { CareerMatchCard } from './CareerMatchCard';
import { 
  useCareerMatches, 
  useUpdateCareerMatch, 
  useAddMatchToDreamJobs,
  type CareerMatch,
} from '@/hooks/useCareerMatches';
import { useGeneratedCurriculumById } from '@/hooks/useGeneratedCurriculum';
import { CurriculumGeneratorWizard, GeneratedCurriculumView } from '@/components/curriculum-generation';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CareerMatchesGridProps {
  onViewDetails?: (match: CareerMatch) => void;
  className?: string;
}

export function CareerMatchesGrid({ onViewDetails, className }: CareerMatchesGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [showDismissed, setShowDismissed] = useState(false);
  const [selectedMatchForCurriculum, setSelectedMatchForCurriculum] = useState<CareerMatch | null>(null);
  const [generatedCurriculumId, setGeneratedCurriculumId] = useState<string | null>(null);

  const { data: matches = [], isLoading } = useCareerMatches({
    minMatchScore: minScore,
    excludeDismissed: !showDismissed,
  });
  
  const updateMatch = useUpdateCareerMatch();
  const addToDreamJobs = useAddMatchToDreamJobs();
  const { data: generatedCurriculum } = useGeneratedCurriculumById(generatedCurriculumId || undefined);

  const filteredMatches = matches.filter(match =>
    match.occupation_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    match.onet_soc_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = (matchId: string) => {
    updateMatch.mutate({ matchId, updates: { is_saved: true } });
  };

  const handleDismiss = (matchId: string) => {
    updateMatch.mutate({ matchId, updates: { is_dismissed: true } });
  };

  const handleAddToDreamJobs = (match: CareerMatch) => {
    addToDreamJobs.mutate({ match });
  };

  const handleGenerateCurriculum = (match: CareerMatch) => {
    setSelectedMatchForCurriculum(match);
  };

  const handleCurriculumComplete = (curriculumId: string) => {
    setSelectedMatchForCurriculum(null);
    setGeneratedCurriculumId(curriculumId);
  };

  if (generatedCurriculumId && generatedCurriculum) {
    return (
      <div className={cn('space-y-4', className)}>
        <GeneratedCurriculumView 
          curriculum={generatedCurriculum} 
          onBack={() => setGeneratedCurriculumId(null)} 
        />
      </div>
    );
  }

  if (selectedMatchForCurriculum) {
    return (
      <div className={cn('space-y-4', className)}>
        <Button variant="ghost" size="sm" onClick={() => setSelectedMatchForCurriculum(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to matches
        </Button>
        <CurriculumGeneratorWizard
          careerMatch={selectedMatchForCurriculum}
          occupationTitle={selectedMatchForCurriculum.occupation_title}
          skillGaps={selectedMatchForCurriculum.skill_gaps || []}
          onComplete={handleCurriculumComplete}
          onCancel={() => setSelectedMatchForCurriculum(null)}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search careers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {(minScore > 0 || showDismissed) && (
                <Badge variant="secondary" className="ml-1">
                  {[minScore > 0, showDismissed].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-4">
            <div className="space-y-2">
              <Label>Minimum Match Score: {minScore}%</Label>
              <Slider
                value={[minScore]}
                onValueChange={([val]) => setMinScore(val)}
                min={0}
                max={100}
                step={5}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-dismissed">Show dismissed</Label>
              <Switch id="show-dismissed" checked={showDismissed} onCheckedChange={setShowDismissed} />
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { setMinScore(0); setShowDismissed(false); }}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredMatches.length} career matches
        {searchQuery && ` for "${searchQuery}"`}
      </div>

      {filteredMatches.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMatches.map((match) => (
            <CareerMatchCard
              key={match.id}
              match={match}
              onSave={() => handleSave(match.id)}
              onDismiss={() => handleDismiss(match.id)}
              onAddToDreamJobs={() => handleAddToDreamJobs(match)}
              onGenerateCurriculum={() => handleGenerateCurriculum(match)}
              onViewDetails={() => onViewDetails?.(match)}
              isLoading={updateMatch.isPending || addToDreamJobs.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {matches.length === 0
              ? 'No career matches yet. Complete the skills assessment to find matches.'
              : 'No matches found with current filters.'}
          </p>
        </div>
      )}
    </div>
  );
}
