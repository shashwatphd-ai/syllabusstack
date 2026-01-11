import { useState } from 'react';
import { GraduationCap, Link2, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { type StudentEnrollment } from '@/hooks/useStudentCourses';
import { type RecommendationWithLinks } from '@/hooks/useRecommendations';
import { cn } from '@/lib/utils';

interface CurrentlyLearningPanelProps {
  enrollments: StudentEnrollment[];
  recommendations: RecommendationWithLinks[];
  onLinkCourse: (enrollmentId: string, courseId: string, recommendationId: string) => Promise<void>;
  isLinking?: boolean;
}

interface SuggestedMatch {
  recommendation: RecommendationWithLinks;
  matchReason: string;
  matchScore: number;
}

/**
 * Finds potential matches between enrolled courses and unlinked recommendations
 */
function findSuggestedMatches(
  enrollment: StudentEnrollment,
  recommendations: RecommendationWithLinks[]
): SuggestedMatch[] {
  const courseTitle = enrollment.instructor_course.title.toLowerCase();
  const courseCode = enrollment.instructor_course.code?.toLowerCase() || '';
  
  return recommendations
    .filter(rec => 
      rec.type === 'course' && 
      !rec.linked_course_id && 
      rec.status !== 'completed' && 
      rec.status !== 'skipped'
    )
    .map(rec => {
      let matchScore = 0;
      let matchReason = '';
      
      const recTitle = rec.title.toLowerCase();
      const recGap = (rec.gap_addressed || '').toLowerCase();
      
      // Check for title overlap
      const titleWords = recTitle.split(/\s+/).filter(w => w.length > 3);
      const courseWords = courseTitle.split(/\s+/).filter(w => w.length > 3);
      const matchingWords = titleWords.filter(w => courseWords.some(cw => cw.includes(w) || w.includes(cw)));
      
      if (matchingWords.length >= 2) {
        matchScore += 60;
        matchReason = `Course covers "${matchingWords.slice(0, 2).join(', ')}"`;
      } else if (matchingWords.length === 1) {
        matchScore += 30;
        matchReason = `Course covers "${matchingWords[0]}"`;
      }
      
      // Check gap addressed
      if (recGap) {
        const gapWords = recGap.split(/\s+/).filter(w => w.length > 3);
        const gapMatches = gapWords.filter(w => courseTitle.includes(w) || courseCode.includes(w));
        if (gapMatches.length > 0) {
          matchScore += 40;
          matchReason = matchReason || `Addresses gap: "${gapMatches[0]}"`;
        }
      }
      
      return { recommendation: rec, matchReason, matchScore };
    })
    .filter(m => m.matchScore > 20)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
}

export function CurrentlyLearningPanel({
  enrollments,
  recommendations,
  onLinkCourse,
  isLinking = false,
}: CurrentlyLearningPanelProps) {
  const navigate = useNavigate();
  const [selectedEnrollment, setSelectedEnrollment] = useState<StudentEnrollment | null>(null);
  const [linkingRecId, setLinkingRecId] = useState<string | null>(null);

  if (enrollments.length === 0) {
    return null;
  }

  const handleLinkClick = async (enrollment: StudentEnrollment, recId: string) => {
    setLinkingRecId(recId);
    try {
      await onLinkCourse(enrollment.id, enrollment.instructor_course_id, recId);
      setSelectedEnrollment(null);
    } finally {
      setLinkingRecId(null);
    }
  };

  const suggestedMatches = selectedEnrollment 
    ? findSuggestedMatches(selectedEnrollment, recommendations)
    : [];

  // Get courses that are already linked to recommendations
  const linkedCourseIds = new Set(
    recommendations
      .filter(r => r.linked_course_id)
      .map(r => r.linked_course_id)
  );

  return (
    <>
      <Card className="border-indigo-200 bg-indigo-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-indigo-600" />
            Currently Learning
          </CardTitle>
          <CardDescription className="text-xs">
            Click a course to link it to your career recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {enrollments.slice(0, 5).map(enrollment => {
              const isLinked = linkedCourseIds.has(enrollment.instructor_course_id);
              const progress = enrollment.overall_progress || 0;
              const isCompleted = !!enrollment.completed_at;
              
              return (
                <button
                  key={enrollment.id}
                  onClick={() => !isLinked && setSelectedEnrollment(enrollment)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-left",
                    isLinked 
                      ? "bg-success/10 border-success/30 cursor-default"
                      : "bg-white border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer"
                  )}
                  disabled={isLinked}
                >
                  <div className="flex flex-col min-w-0">
                    <span className={cn(
                      "text-sm font-medium truncate max-w-[150px]",
                      isLinked ? "text-success" : "text-indigo-700"
                    )}>
                      {enrollment.instructor_course.title}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          Complete
                        </span>
                      ) : (
                        <>
                          <Progress value={progress} className="h-1 w-12" />
                          <span>{progress}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isLinked ? (
                    <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/30 shrink-0">
                      <Link2 className="h-2.5 w-2.5 mr-0.5" />
                      Linked
                    </Badge>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-indigo-400 group-hover:text-indigo-600 shrink-0" />
                  )}
                </button>
              );
            })}
            {enrollments.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/learn/courses')}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                View all {enrollments.length} →
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Link Course Dialog */}
      <Dialog 
        open={!!selectedEnrollment} 
        onOpenChange={(open) => !open && setSelectedEnrollment(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Link "{selectedEnrollment?.instructor_course.title}"
            </DialogTitle>
            <DialogDescription>
              Connect this course to a career recommendation to track your progress
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Course Info */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <GraduationCap className="h-8 w-8 text-indigo-600" />
              <div className="flex-1">
                <p className="font-medium">{selectedEnrollment?.instructor_course.title}</p>
                {selectedEnrollment?.instructor_course.code && (
                  <p className="text-xs text-muted-foreground">{selectedEnrollment.instructor_course.code}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{selectedEnrollment?.overall_progress || 0}%</p>
                <p className="text-xs text-muted-foreground">Progress</p>
              </div>
            </div>

            {/* Suggested Matches */}
            {suggestedMatches.length > 0 ? (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-success/10 text-success text-xs rounded">Suggested</span>
                  Matching Recommendations
                </h4>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2 pr-4">
                    {suggestedMatches.map(({ recommendation, matchReason }) => (
                      <button
                        key={recommendation.id}
                        onClick={() => handleLinkClick(selectedEnrollment!, recommendation.id)}
                        disabled={isLinking}
                        className="w-full text-left p-3 rounded-lg border border-success/30 bg-success/5 hover:bg-success/10 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{recommendation.title}</p>
                            <p className="text-xs text-success">{matchReason}</p>
                            {recommendation.gap_addressed && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                Gap: {recommendation.gap_addressed}
                              </p>
                            )}
                          </div>
                          {linkingRecId === recommendation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-success shrink-0" />
                          ) : (
                            <Link2 className="h-4 w-4 text-success shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">No matching recommendations found.</p>
                <p className="text-xs mt-1">
                  You can manually link this course from any recommendation card.
                </p>
              </div>
            )}

            {/* All Unlinked Recommendations */}
            {recommendations.filter(r => 
              r.type === 'course' && 
              !r.linked_course_id && 
              r.status !== 'completed' && 
              r.status !== 'skipped' &&
              !suggestedMatches.some(m => m.recommendation.id === r.id)
            ).length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Other Recommendations</h4>
                <ScrollArea className="max-h-[150px]">
                  <div className="space-y-2 pr-4">
                    {recommendations
                      .filter(r => 
                        r.type === 'course' && 
                        !r.linked_course_id && 
                        r.status !== 'completed' && 
                        r.status !== 'skipped' &&
                        !suggestedMatches.some(m => m.recommendation.id === r.id)
                      )
                      .slice(0, 5)
                      .map(rec => (
                        <button
                          key={rec.id}
                          onClick={() => handleLinkClick(selectedEnrollment!, rec.id)}
                          disabled={isLinking}
                          className="w-full text-left p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{rec.title}</p>
                              {rec.gap_addressed && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  Gap: {rec.gap_addressed}
                                </p>
                              )}
                            </div>
                            {linkingRecId === rec.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                            ) : (
                              <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
