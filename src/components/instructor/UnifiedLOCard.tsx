import React, { useState, useCallback, memo } from 'react';
import { ChevronDown, ChevronRight, Video, Search, Loader2, CheckCircle, XCircle, Play, Link, Clock, ExternalLink, Sparkles, Bot, AlertTriangle, ThumbsUp, Info, MessageSquare, Zap, Award, Users, Trash2, Brain, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { LearningObjective, ContentMatch, useContentMatches, useSearchYouTubeContent, useUpdateContentMatchStatus } from '@/hooks/useLearningObjectives';
import { useVideoOtherMatches } from '@/hooks/useVideoOtherMatches';
import { useGenerateMicroChecks } from '@/hooks/useAssessment';
import { useTeachingUnits, useDecomposeLearningObjective, useSearchForTeachingUnit, TeachingUnit } from '@/hooks/useTeachingUnits';
import { useCourseLectureSlides, useGenerateLectureSlides } from '@/hooks/useLectureSlides';
import { VideoPreviewModal } from './VideoPreviewModal';
import { ManualContentSearch } from './ManualContentSearch';
import { AddVideoByURL } from './AddVideoByURL';
import { ContentAssistantChat } from './ContentAssistantChat';
import { TeachingUnitCard } from './TeachingUnitCard';
import { LectureSlideViewer } from '@/components/slides/LectureSlideViewer';

interface UnifiedLOCardProps {
  learningObjective: LearningObjective;
  contentStatus: {
    hasContent: boolean;
    pendingCount: number;
    approvedCount: number;
  };
}

// Bloom's Taxonomy descriptions for tooltips
const bloomDescriptions: Record<string, { title: string; description: string; color: string }> = {
  remember: {
    title: 'Remember',
    description: 'Recall facts and basic concepts. Activities: define, list, memorize, repeat.',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  understand: {
    title: 'Understand',
    description: 'Explain ideas or concepts. Activities: classify, describe, discuss, explain.',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  apply: {
    title: 'Apply',
    description: 'Use information in new situations. Activities: execute, implement, solve, use.',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  analyze: {
    title: 'Analyze',
    description: 'Draw connections among ideas. Activities: differentiate, organize, compare, deconstruct.',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  },
  evaluate: {
    title: 'Evaluate',
    description: 'Justify a decision or course of action. Activities: appraise, argue, critique, judge.',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  create: {
    title: 'Create',
    description: 'Produce new or original work. Activities: design, assemble, construct, develop.',
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  },
};

export const UnifiedLOCard = memo(function UnifiedLOCard({ learningObjective, contentStatus }: UnifiedLOCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewMatch, setPreviewMatch] = useState<ContentMatch | null>(null);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [showAddByURL, setShowAddByURL] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [slideViewerUnit, setSlideViewerUnit] = useState<TeachingUnit | null>(null);

  const { data: contentMatches, isLoading: loadingMatches } = useContentMatches(isOpen ? learningObjective.id : undefined);
  const searchContent = useSearchYouTubeContent();
  const updateStatus = useUpdateContentMatchStatus();
  const generateMicroChecks = useGenerateMicroChecks();
  
  // Teaching Units integration
  const { data: teachingUnits, isLoading: loadingUnits } = useTeachingUnits(isOpen ? learningObjective.id : undefined);
  const decomposeMutation = useDecomposeLearningObjective();
  const searchForUnit = useSearchForTeachingUnit();
  
  // Lecture Slides integration
  const { data: courseLectureSlides } = useCourseLectureSlides(learningObjective.instructor_course_id || undefined);
  const generateSlidesMutation = useGenerateLectureSlides();
  
  // Map teaching unit IDs to their slides
  const slidesByUnitId = (courseLectureSlides || []).reduce((acc, slide) => {
    acc[slide.teaching_unit_id] = slide;
    return acc;
  }, {} as Record<string, typeof courseLectureSlides[0]>);

  const pendingMatches = contentMatches?.filter(m => m.status === 'pending') || [];
  const approvedMatches = contentMatches?.filter(m => m.status === 'approved' || m.status === 'auto_approved') || [];
  
  const hasTeachingUnits = teachingUnits && teachingUnits.length > 0;
  
  // Handle lecture slide creation/viewing
  const handleCreateLecture = async (unit: TeachingUnit) => {
    const existingSlide = slidesByUnitId[unit.id];
    
    if (existingSlide && existingSlide.status !== 'failed') {
      // Open existing slides in viewer
      setSlideViewerUnit(unit);
    } else {
      // Generate new slides
      await generateSlidesMutation.mutateAsync({ 
        teachingUnitId: unit.id,
        regenerate: existingSlide?.status === 'failed'
      });
      // After generation, open the viewer
      setSlideViewerUnit(unit);
    }
  };

  const getBloomInfo = (level: string | null) => {
    return bloomDescriptions[level || ''] || { 
      title: level || 'Unknown', 
      description: 'Cognitive level not specified.', 
      color: 'bg-muted text-muted-foreground' 
    };
  };

  const getStatusIndicator = () => {
    if (contentStatus.approvedCount > 0) {
      return <div className="w-3 h-3 rounded-full bg-success" title="Has approved content" />;
    }
    if (contentStatus.pendingCount > 0) {
      return <div className="w-3 h-3 rounded-full bg-warning" title="Has pending content" />;
    }
    return <div className="w-3 h-3 rounded-full bg-muted-foreground/30" title="No content" />;
  };

  const handleApprove = async (match: ContentMatch) => {
    await updateStatus.mutateAsync({ matchId: match.id, status: 'approved' });
    
    // Auto-generate micro-checks for approved content
    if (match.content) {
      generateMicroChecks.mutate({
        contentId: match.content.id,
        learningObjectiveId: learningObjective.id,
        contentTitle: match.content.title,
        contentDescription: match.content.description || undefined,
        durationSeconds: match.content.duration_seconds || 600,
        learningObjectiveText: learningObjective.text,
        numChecks: 3,
      });
    }
    
    setPreviewMatch(null);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.75) return 'text-success';
    if (score >= 0.5) return 'text-warning';
    return 'text-destructive';
  };

  // Get actual video duration from first approved match
  const actualVideoDuration = approvedMatches[0]?.content?.duration_seconds;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors">
          <CollapsibleTrigger asChild>
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer">
              {/* Chevron and status indicator */}
              <div className="flex items-center gap-2 sm:mt-1 shrink-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                {getStatusIndicator()}
              </div>
              
              {/* Main content area */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-relaxed">{learningObjective.text}</p>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                  {/* Bloom's Level with Tooltip */}
                  {learningObjective.bloom_level && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className={`text-[10px] sm:text-xs cursor-help ${getBloomInfo(learningObjective.bloom_level).color}`}>
                            {learningObjective.bloom_level}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold">{getBloomInfo(learningObjective.bloom_level).title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getBloomInfo(learningObjective.bloom_level).description}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Duration with Tooltip */}
                  {learningObjective.expected_duration_minutes && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[10px] sm:text-xs text-muted-foreground cursor-help flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            ~{learningObjective.expected_duration_minutes} min
                            {actualVideoDuration && (
                              <span className="text-success">
                                → {Math.round(actualVideoDuration / 60)}m
                              </span>
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold">Estimated Duration</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Based on Bloom's level ({learningObjective.bloom_level}) and topic complexity.
                            {actualVideoDuration && (
                              <span className="block mt-1 text-success">
                                Actual video: {Math.round(actualVideoDuration / 60)} minutes
                              </span>
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {contentStatus.approvedCount > 0 && (
                    <Badge variant="outline" className="text-[10px] sm:text-xs text-success border-success/30">
                      {contentStatus.approvedCount} approved
                    </Badge>
                  )}
                  {contentStatus.pendingCount > 0 && (
                    <Badge variant="outline" className="text-[10px] sm:text-xs text-warning border-warning/30">
                      {contentStatus.pendingCount} pending
                    </Badge>
                  )}
                </div>
              </div>

              {/* Find button */}
              <div className="flex items-center gap-2 self-end sm:self-start" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 min-h-[2rem]"
                  onClick={() => searchContent.mutate(learningObjective)}
                  disabled={searchContent.isPending}
                >
                  {searchContent.isPending ? (
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
            <div className="px-4 pb-4 pt-0 border-t border-border/50">
              {/* Action buttons */}
              <div className="flex items-center gap-2 py-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowManualSearch(true)}
                >
                  <Search className="h-3 w-3" />
                  Search YouTube
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowAddByURL(true)}
                >
                  <Link className="h-3 w-3" />
                  Add by URL
                </Button>
                <Button
                  variant={showAIAssistant ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowAIAssistant(!showAIAssistant)}
                >
                  <Bot className="h-3 w-3" />
                  AI Assistant
                </Button>
              </div>

              {/* AI Assistant Chat Panel */}
              {showAIAssistant && (
                <div className="mb-4">
                  <ContentAssistantChat
                    learningObjectiveId={learningObjective.id}
                    learningObjectiveText={learningObjective.text}
                    bloomLevel={learningObjective.bloom_level || undefined}
                    onSearchRequest={(query) => {
                      // Trigger the actual search when AI suggests one
                      searchContent.mutate(learningObjective);
                    }}
                    onClose={() => setShowAIAssistant(false)}
                  />
                </div>
              )}

              {loadingMatches || loadingUnits ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Teaching Units Section - NEW */}
                  {hasTeachingUnits ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Layers className="h-3 w-3" />
                          Teaching Units ({teachingUnits.length})
                        </p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[10px] cursor-help">
                                <Brain className="h-2.5 w-2.5 mr-1" />
                                AI Decomposed
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">This learning objective has been analyzed and broken down into teachable micro-concepts for better video matching.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      
                      {teachingUnits.map(unit => (
                        <TeachingUnitCard
                          key={unit.id}
                          unit={unit}
                          contentMatches={contentMatches?.filter(m => m.teaching_unit_id === unit.id) || []}
                          onSearch={() => searchForUnit.mutate(unit.id)}
                          isSearching={searchForUnit.isSearching(unit.id)}
                          onCreateLecture={handleCreateLecture}
                          isGeneratingSlides={generateSlidesMutation.isPending && generateSlidesMutation.variables?.teachingUnitId === unit.id}
                          generationProgress={generateSlidesMutation.isPending && generateSlidesMutation.variables?.teachingUnitId === unit.id ? generateSlidesMutation.progress : null}
                          existingSlides={slidesByUnitId[unit.id] || null}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 border border-dashed border-border rounded-lg">
                      <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm font-medium">Ready for Analysis</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Break down this learning objective into teachable concepts
                      </p>
                      <Button
                        size="sm"
                        onClick={() => decomposeMutation.mutate(learningObjective.id)}
                        disabled={decomposeMutation.isPending || learningObjective.decomposition_status === 'in_progress'}
                        className="gap-1.5"
                      >
                        {decomposeMutation.isPending || learningObjective.decomposition_status === 'in_progress' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {decomposeMutation.isPending || learningObjective.decomposition_status === 'in_progress' ? 'Analyzing...' : 'Analyze & Break Down'}
                      </Button>
                    </div>
                  )}

                  {/* Existing content that isn't tied to teaching units */}
                  {contentMatches && contentMatches.length > 0 && (
                    <div className="space-y-3">
                      {/* Approved content */}
                      {approvedMatches.filter(m => !m.teaching_unit_id).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Approved ({approvedMatches.filter(m => !m.teaching_unit_id).length})
                          </p>
                          {approvedMatches.filter(m => !m.teaching_unit_id).map((match) => (
                            <CompactContentCard
                              key={match.id}
                              match={match}
                              learningObjectiveId={learningObjective.id}
                              onPreview={() => setPreviewMatch(match)}
                              onRemove={() => updateStatus.mutate({ 
                                matchId: match.id, 
                                status: 'rejected',
                                rejectionReason: 'Removed by instructor'
                              })}
                              formatDuration={formatDuration}
                              getScoreColor={getScoreColor}
                              isApproved
                              isLoading={updateStatus.isPending}
                            />
                          ))}
                        </div>
                      )}

                      {/* Pending content */}
                      {pendingMatches.filter(m => !m.teaching_unit_id).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Pending Review ({pendingMatches.filter(m => !m.teaching_unit_id).length})
                          </p>
                          {pendingMatches.filter(m => !m.teaching_unit_id).map((match) => (
                            <CompactContentCard
                              key={match.id}
                              match={match}
                              learningObjectiveId={learningObjective.id}
                              onPreview={() => setPreviewMatch(match)}
                              onApprove={() => handleApprove(match)}
                              onReject={() => updateStatus.mutate({ matchId: match.id, status: 'rejected' })}
                              formatDuration={formatDuration}
                              getScoreColor={getScoreColor}
                              isLoading={updateStatus.isPending}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Empty state - only show if no content and no teaching units */}
                  {(!contentMatches || contentMatches.length === 0) && !hasTeachingUnits && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No content found yet</p>
                      <p className="text-xs">Click "Analyze & Break Down" or "Find" to search for videos</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Preview Modal */}
      <VideoPreviewModal
        match={previewMatch}
        open={previewMatch !== null}
        onOpenChange={(open) => !open && setPreviewMatch(null)}
        onApprove={() => previewMatch && handleApprove(previewMatch)}
        onReject={() => {
          if (previewMatch) {
            updateStatus.mutate({ matchId: previewMatch.id, status: 'rejected' });
            setPreviewMatch(null);
          }
        }}
        isLoading={updateStatus.isPending}
      />

      {/* Manual Search Dialog */}
      <ManualContentSearch
        open={showManualSearch}
        onOpenChange={setShowManualSearch}
        learningObjectiveId={learningObjective.id}
        learningObjectiveText={learningObjective.text}
      />

      {/* Add by URL Dialog */}
      <AddVideoByURL
        open={showAddByURL}
        onOpenChange={setShowAddByURL}
        learningObjectiveId={learningObjective.id}
      />

      {/* Lecture Slide Viewer Dialog */}
      {slideViewerUnit && slidesByUnitId[slideViewerUnit.id] && (
        <LectureSlideViewer
          lectureSlide={slidesByUnitId[slideViewerUnit.id]}
          teachingUnit={slideViewerUnit}
          open={!!slideViewerUnit}
          onOpenChange={(open) => !open && setSlideViewerUnit(null)}
        />
      )}
    </>
  );
});

interface CompactContentCardProps {
  match: ContentMatch;
  learningObjectiveId: string;
  onPreview: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
  formatDuration: (s: number | null) => string;
  getScoreColor: (s: number) => string;
  isApproved?: boolean;
  isLoading?: boolean;
}

// Helper to get AI recommendation badge info
function getAIRecommendationBadge(recommendation: string | null) {
  switch (recommendation) {
    case 'highly_recommended':
      return { label: 'AI Pick', variant: 'default' as const, className: 'bg-success/10 text-success border-success/30', icon: Sparkles };
    case 'recommended':
      return { label: 'Good Match', variant: 'outline' as const, className: 'text-primary border-primary/30', icon: ThumbsUp };
    case 'acceptable':
      return { label: 'Acceptable', variant: 'outline' as const, className: 'text-muted-foreground', icon: null };
    case 'not_recommended':
      return { label: 'Not Ideal', variant: 'outline' as const, className: 'text-warning border-warning/30', icon: AlertTriangle };
    default:
      return null;
  }
}

// Phase 2: Helper to get approval type info
function getApprovalBadge(match: ContentMatch) {
  if (match.status === 'auto_approved') {
    // Determine WHY it was auto-approved
    const isAIApproved = match.ai_recommendation === 'highly_recommended';
    const isScoreApproved = match.match_score >= 0.75;
    
    if (isAIApproved && isScoreApproved) {
      return { 
        label: 'AI + Score', 
        tooltip: `Auto-approved: AI highly recommended (${match.ai_recommendation}) AND high match score (${Math.round(match.match_score * 100)}%)`,
        icon: Award,
        className: 'bg-success/20 text-success border-success/40'
      };
    } else if (isAIApproved) {
      return { 
        label: 'AI Approved', 
        tooltip: `Auto-approved: AI highly recommended this video as an excellent pedagogical match`,
        icon: Sparkles,
        className: 'bg-primary/10 text-primary border-primary/30'
      };
    } else {
      return { 
        label: 'Score Approved', 
        tooltip: `Auto-approved: Match score of ${Math.round(match.match_score * 100)}% exceeded the 75% threshold`,
        icon: Zap,
        className: 'bg-success/10 text-success border-success/30'
      };
    }
  } else if (match.status === 'approved') {
    return { 
      label: 'You Approved', 
      tooltip: `Manually approved${match.approved_at ? ` on ${new Date(match.approved_at).toLocaleDateString()}` : ''}`,
      icon: CheckCircle,
      className: 'bg-success/10 text-success border-success/30'
    };
  }
  return null;
}

function CompactContentCard({
  match,
  learningObjectiveId,
  onPreview,
  onApprove,
  onReject,
  onRemove,
  formatDuration,
  getScoreColor,
  isApproved,
  isLoading,
}: CompactContentCardProps) {
  const content = match.content;
  const aiBadge = getAIRecommendationBadge(match.ai_recommendation);
  
  // Phase 4: Check if this video is used in other learning objectives
  const { data: otherMatches } = useVideoOtherMatches(content?.id, learningObjectiveId);

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30 border border-border/50">
      {/* Thumbnail */}
      <div 
        className="relative w-20 h-12 flex-shrink-0 rounded overflow-hidden cursor-pointer group bg-muted"
        onClick={onPreview}
      >
        {content?.thumbnail_url ? (
          <img 
            src={content.thumbnail_url} 
            alt={content.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="h-4 w-4 text-white" />
        </div>
        {content?.duration_seconds && (
          <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/80 text-white text-[10px] rounded">
            {formatDuration(content.duration_seconds)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{content?.title || 'Unknown'}</p>
        </div>
        <p className="text-xs text-muted-foreground truncate">{content?.channel_name}</p>
        
        {/* AI Badges Row */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {/* AI Recommendation Badge */}
          {aiBadge && (
            <Badge variant={aiBadge.variant} className={`text-[10px] h-5 ${aiBadge.className}`}>
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              {aiBadge.label}
            </Badge>
          )}
          
          {/* AI Concern Badge */}
          {match.ai_concern && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] h-5 text-warning border-warning/30 cursor-help">
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                    Note
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium text-warning">AI Concern</p>
                  <p className="text-xs mt-1">{match.ai_concern}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* "Why this video?" tooltip */}
          {match.ai_reasoning && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-primary"
                  >
                    <Info className="h-2.5 w-2.5 mr-0.5" />
                    Why?
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <div className="space-y-2">
                    <p className="font-medium flex items-center gap-1">
                      <Bot className="h-3 w-3" /> AI Reasoning
                    </p>
                    <p className="text-xs">{match.ai_reasoning}</p>
                    {(match.ai_relevance_score !== null || match.ai_pedagogy_score !== null || match.ai_quality_score !== null) && (
                      <div className="flex gap-2 text-[10px] pt-1 border-t border-border">
                        {match.ai_relevance_score !== null && (
                          <span>Relevance: {Math.round(match.ai_relevance_score * 100)}%</span>
                        )}
                        {match.ai_pedagogy_score !== null && (
                          <span>Pedagogy: {Math.round(match.ai_pedagogy_score * 100)}%</span>
                        )}
                        {match.ai_quality_score !== null && (
                          <span>Quality: {Math.round(match.ai_quality_score * 100)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* Phase 4: Cross-module indicator */}
          {otherMatches && otherMatches.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground cursor-help">
                    <Users className="h-2.5 w-2.5 mr-0.5" />
                    +{otherMatches.length}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium text-xs mb-1">Also used in {otherMatches.length} other objective{otherMatches.length > 1 ? 's' : ''}</p>
                  <ul className="text-[10px] text-muted-foreground space-y-1">
                    {otherMatches.slice(0, 3).map((om, i) => (
                      <li key={i} className="truncate">
                        {om.moduleTitle && <span className="text-primary">{om.moduleTitle}: </span>}
                        {om.learningObjectiveText.slice(0, 50)}...
                      </li>
                    ))}
                    {otherMatches.length > 3 && (
                      <li className="text-muted-foreground/70">...and {otherMatches.length - 3} more</li>
                    )}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="flex-shrink-0 text-right">
        <span className={`text-lg font-bold ${getScoreColor(match.match_score)}`}>
          {Math.round(match.match_score * 100)}%
        </span>
      </div>

      {/* Actions */}
      {isApproved ? (
        (() => {
          const approvalBadge = getApprovalBadge(match);
          const ApprovalIcon = approvalBadge?.icon || CheckCircle;
          return (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className={`text-[10px] h-5 cursor-help ${approvalBadge?.className || 'bg-success/10 text-success'}`}>
                      <ApprovalIcon className="h-2.5 w-2.5 mr-0.5" />
                      {approvalBadge?.label || '✓'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">{approvalBadge?.tooltip || 'Approved'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {content?.source_id && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        asChild
                        aria-label="Open video on YouTube"
                      >
                        <a
                          href={`https://www.youtube.com/watch?v=${content.source_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open on YouTube</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {onRemove && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                        onClick={onRemove}
                        disabled={isLoading}
                        aria-label="Remove content from course"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove from course</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        })()
      ) : (
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                  onClick={onApprove}
                  disabled={isLoading}
                  aria-label="Approve recommendation"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Approve</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onReject}
                  disabled={isLoading}
                  aria-label="Reject recommendation"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reject</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
