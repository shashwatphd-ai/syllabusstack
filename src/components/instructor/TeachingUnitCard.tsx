import React, { useState, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  BookOpen,
  Video,
  Lightbulb,
  ArrowRight,
  Presentation,
  XCircle
} from 'lucide-react';
import { TeachingUnit } from '@/hooks/useTeachingUnits';
import { ContentMatch } from '@/hooks/useLearningObjectives';
import type { LectureSlide } from '@/hooks/useLectureSlides';

interface GenerationProgress {
  phase: string;
  percent: number;
  message: string;
}

interface TeachingUnitCardProps {
  unit: TeachingUnit;
  contentMatches: ContentMatch[];
  onSearch: (unit: TeachingUnit) => void;
  onCreateLecture?: (unit: TeachingUnit) => void;
  onCancelQueuedSlide?: (teachingUnitId: string) => void;
  onReviewVideo?: (match: ContentMatch) => void;
  isSearching: boolean;
  isGeneratingSlides?: boolean;
  generationProgress?: GenerationProgress | null;
  existingSlides?: LectureSlide | null;
}

const VIDEO_TYPE_ICONS: Record<string, string> = {
  explainer: '💡',
  tutorial: '🛠️',
  case_study: '📊',
  worked_example: '✏️',
  lecture: '🎓',
  demonstration: '🎬',
};

const VIDEO_TYPE_LABELS: Record<string, string> = {
  explainer: 'Explainer',
  tutorial: 'Tutorial',
  case_study: 'Case Study',
  worked_example: 'Worked Example',
  lecture: 'Lecture',
  demonstration: 'Demo',
};

function getStatusBadge(status: TeachingUnit['status'], videosFound: number) {
  switch (status) {
    case 'approved':
      return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Ready</Badge>;
    case 'found':
      return <Badge variant="secondary"><Video className="h-3 w-3 mr-1" /> {videosFound} found</Badge>;
    case 'searching':
      return <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Searching</Badge>;
    case 'failed':
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
    default:
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
  }
}

export const TeachingUnitCard = memo(function TeachingUnitCard({ 
  unit, 
  contentMatches, 
  onSearch, 
  onCreateLecture,
  onCancelQueuedSlide,
  onReviewVideo,
  isSearching,
  isGeneratingSlides,
  generationProgress,
  existingSlides
}: TeachingUnitCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllVideos, setShowAllVideos] = useState(false);
  
  // contentMatches is already pre-filtered by the parent (includes auto-assigned unlinked videos)
  const unitMatches = contentMatches.filter(m => m.status !== 'pending_evaluation');
  const approvedVideos = unitMatches.filter(m => 
    m.status === 'approved' || m.status === 'auto_approved'
  );
  const pendingVideos = unitMatches.filter(m => m.status === 'pending');
  
  const hasContent = approvedVideos.length > 0;
  const currentStatus = hasContent ? 'approved' : unit.status;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={`border-l-4 ${hasContent ? 'border-l-green-500' : 'border-l-primary/30'}`}>
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            {/* Mobile-first layout: Stack on small screens, row on larger */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {/* Title row */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                
                <Badge variant="outline" className="flex-shrink-0 h-5 w-5 p-0 justify-center text-xs">
                  {unit.sequence_order}
                </Badge>
                
                <span className="font-medium text-sm truncate flex-1">{unit.title}</span>
              </div>

              {/* Badges row - wraps on mobile */}
              <div className="flex items-center gap-1.5 flex-wrap pl-6 sm:pl-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="flex-shrink-0 text-xs py-0.5">
                        {VIDEO_TYPE_ICONS[unit.target_video_type]} {VIDEO_TYPE_LABELS[unit.target_video_type]}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Target video type: {unit.target_video_type}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  ~{unit.target_duration_minutes}m
                </span>

                {getStatusBadge(currentStatus, unitMatches.length)}
                
                {approvedVideos.length > 0 && (
                  <Badge variant="default" className="bg-green-600 text-xs py-0.5">
                    {approvedVideos.length} ✓
                  </Badge>
                )}
                {pendingVideos.length > 0 && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs py-0.5">
                    {pendingVideos.length} review
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Actions row - always visible at bottom on mobile */}
            <div className="flex items-center gap-2 mt-2 pl-6 sm:pl-0 sm:justify-end">
              {/* Lecture status/button */}
              {onCreateLecture && (
                <>
                  {/* Pending status - actionable Cancel + Generate buttons */}
                  {existingSlides?.status === 'pending' && (
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCancelQueuedSlide?.(unit.id);
                              }}
                              className="gap-1 h-7 text-xs text-muted-foreground hover:text-destructive"
                            >
                              <XCircle className="h-3 w-3" />
                              Cancel
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove queued placeholder so you can re-trigger</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCreateLecture?.(unit);
                              }}
                              disabled={isGeneratingSlides}
                              className="gap-1 h-7 text-xs border-blue-500 text-blue-600"
                            >
                              <Presentation className="h-3 w-3" />
                              Generate
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Generate lecture slides now</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}

                  {/* Preparing/Batch pending status - batch is being set up or processing */}
                  {(existingSlides?.status === 'preparing' || existingSlides?.status === 'batch_pending') && (
                    <Badge variant="outline" className="text-xs py-0.5 border-amber-500 text-amber-600">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      {existingSlides?.status === 'preparing' ? 'Preparing...' : 'Batch Processing...'}
                    </Badge>
                  )}

                  {/* Generating status */}
                  {existingSlides?.status === 'generating' && (
                    <Badge variant="outline" className="text-xs py-0.5 border-amber-500 text-amber-600">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Generating...
                    </Badge>
                  )}
                  
                  {/* Failed status - show retry button */}
                  {existingSlides?.status === 'failed' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateLecture(unit);
                            }}
                            disabled={isGeneratingSlides}
                            className="gap-1 h-8 text-xs"
                          >
                            {isGeneratingSlides ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            Retry
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-medium text-destructive">Generation failed</p>
                          <p className="text-xs mt-1">{existingSlides.error_message || 'Unknown error'}</p>
                          <p className="text-xs mt-1 text-muted-foreground">Click to retry</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Ready/Published - show view button */}
                  {(existingSlides?.status === 'ready' || existingSlides?.status === 'published') && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant={existingSlides.status === 'published' ? 'default' : 'outline'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateLecture(unit);
                            }}
                            disabled={isGeneratingSlides}
                            className="gap-1 h-8 text-xs"
                          >
                            <Presentation className="h-3 w-3" />
                            <span className="hidden sm:inline">
                              {existingSlides.status === 'published' ? 'Slides ✓' : 'View'}
                            </span>
                            <span className="sm:hidden">✓</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {existingSlides.total_slides} slides - {existingSlides.status}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* No slides - show create button */}
                  {!existingSlides && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateLecture(unit);
                            }}
                            disabled={isGeneratingSlides}
                            className="gap-1 h-8 text-xs"
                          >
                            {isGeneratingSlides ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="hidden sm:inline">
                                  {generationProgress?.message
                                    ? `${generationProgress.percent}%`
                                    : 'Generating...'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Presentation className="h-3 w-3" />
                                <span className="hidden sm:inline">Create Lecture</span>
                                <span className="sm:hidden">Lecture</span>
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isGeneratingSlides && generationProgress?.message
                            ? generationProgress.message
                            : 'Generate lecture slides from this unit'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </>
              )}

              <Button 
                size="sm" 
                variant="outline" 
                onClick={(e) => {
                  e.stopPropagation();
                  onSearch(unit);
                }}
                disabled={isSearching || unit.status === 'searching'}
                className="gap-1 h-8 text-xs"
              >
                {isSearching || unit.status === 'searching' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
                Find
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {/* What to teach */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                What to Teach
              </div>
              <p className="text-sm pl-6">{unit.what_to_teach}</p>
            </div>
            
            {/* Why it matters */}
            {unit.why_this_matters && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Lightbulb className="h-4 w-4" />
                  Why This Matters
                </div>
                <p className="text-sm pl-6 text-muted-foreground">{unit.why_this_matters}</p>
              </div>
            )}
            
            {/* Prerequisites & Enables */}
            {(unit.prerequisites?.length || unit.enables?.length) && (
              <div className="flex gap-6 text-sm">
                {unit.prerequisites && unit.prerequisites.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Prerequisites:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {unit.prerequisites.map((prereq, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {prereq}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {unit.enables && unit.enables.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Enables:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {unit.enables.map((next, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <ArrowRight className="h-2 w-2 mr-1" />
                          {next}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Search queries */}
            {unit.search_queries?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Search Queries</p>
                <div className="flex flex-wrap gap-1">
                  {unit.search_queries.map((query, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal">
                      "{query}"
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Common misconceptions */}
            {unit.common_misconceptions && unit.common_misconceptions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Common Misconceptions to Address</p>
                <ul className="text-xs text-muted-foreground pl-4 list-disc">
                  {unit.common_misconceptions.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Video matches for this unit */}
            {unitMatches.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground">
                  Found Videos ({unitMatches.length})
                </p>
                <div className="space-y-2">
                  {(showAllVideos ? unitMatches : unitMatches.slice(0, 3)).map(match => (
                    <div 
                      key={match.id} 
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => onReviewVideo?.(match)}
                    >
                      {match.content?.thumbnail_url && (
                        <img 
                          src={match.content.thumbnail_url} 
                          alt="" 
                          className="w-16 h-10 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{match.content?.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {match.content?.channel_name} • Score: {Math.round(match.match_score * 100)}%
                        </p>
                      </div>
                      {match.status === 'approved' || match.status === 'auto_approved' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Button variant="outline" size="sm" className="text-xs h-7 shrink-0">
                          Review
                        </Button>
                      )}
                    </div>
                  ))}
                  {unitMatches.length > 3 && !showAllVideos && (
                    <button
                      onClick={() => setShowAllVideos(true)}
                      className="text-xs text-primary hover:underline text-center w-full py-1 cursor-pointer"
                    >
                      +{unitMatches.length - 3} more videos — click to expand
                    </button>
                  )}
                  {unitMatches.length > 3 && showAllVideos && (
                    <button
                      onClick={() => setShowAllVideos(false)}
                      className="text-xs text-primary hover:underline text-center w-full py-1 cursor-pointer"
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});
