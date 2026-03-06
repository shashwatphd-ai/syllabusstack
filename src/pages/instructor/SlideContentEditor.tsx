import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { useLectureSlide, useUpdateLectureSlide, useUnpublishLectureSlides } from '@/hooks/lectureSlides';
import type { ProfessorSlide } from '@/hooks/lectureSlides';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SlideEditCard } from '@/components/instructor/slides/SlideEditCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; editable: boolean }> = {
  ready: { label: 'Ready', variant: 'default', editable: true },
  published: { label: 'Published', variant: 'secondary', editable: false },
  generating: { label: 'Generating…', variant: 'outline', editable: false },
  batch_pending: { label: 'Queued', variant: 'outline', editable: false },
  failed: { label: 'Failed', variant: 'destructive', editable: true },
  pending: { label: 'Pending', variant: 'outline', editable: false },
  preparing: { label: 'Preparing', variant: 'outline', editable: false },
};

export default function SlideContentEditor() {
  const { courseId, lectureSlideId } = useParams<{ courseId: string; lectureSlideId: string }>();
  const navigate = useNavigate();
  const { data: lectureSlide, isLoading } = useLectureSlide(lectureSlideId);
  const updateMutation = useUpdateLectureSlide();
  const unpublishMutation = useUnpublishLectureSlides();

  // Local editable copy of slides
  const [editedSlides, setEditedSlides] = useState<ProfessorSlide[] | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [expandedSlide, setExpandedSlide] = useState<number | null>(0);

  // Initialize edited slides from data
  const slides = editedSlides ?? (lectureSlide?.slides as unknown as ProfessorSlide[]) ?? [];

  const status = lectureSlide?.status ?? 'pending';
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const isEditable = statusConfig.editable;

  const handleSlideChange = useCallback((index: number, updatedSlide: ProfessorSlide) => {
    const newSlides = [...slides];
    newSlides[index] = updatedSlide;
    setEditedSlides(newSlides);
    setHasChanges(true);
  }, [slides]);

  const handleSave = useCallback(async () => {
    if (!lectureSlideId || !editedSlides) return;
    await updateMutation.mutateAsync({
      slideId: lectureSlideId,
      slides: editedSlides,
    });
    setHasChanges(false);
  }, [lectureSlideId, editedSlides, updateMutation]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      setShowUnsavedDialog(true);
    } else {
      navigate(`/instructor/courses/${courseId}`);
    }
  }, [hasChanges, navigate, courseId]);

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  if (!lectureSlide) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <AlertTriangle className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Lecture slides not found.</p>
            <Button variant="outline" onClick={() => navigate(`/instructor/courses/${courseId}`)}>
              Back to Course
            </Button>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">{lectureSlide.title}</h1>
              <p className="text-sm text-muted-foreground">
                {slides.length} slides · Edit content before publishing
              </p>
            </div>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-sm text-muted-foreground">Unsaved changes</span>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending || !isEditable}
              size="sm"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save All
            </Button>
          </div>
        </div>

        {!isEditable && (
          <div className="rounded-md border border-border bg-muted/50 p-3 mb-6 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                {status === 'published'
                  ? 'This lecture is published. Unpublish it to make edits.'
                  : 'Editing is disabled while slides are being generated.'}
              </p>
            </div>
            {status === 'published' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => unpublishMutation.mutate(lectureSlideId!)}
                disabled={unpublishMutation.isPending}
              >
                {unpublishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Unpublish & Edit
              </Button>
            )}
          </div>
        )}

        <Separator className="mb-6" />

        {/* Slide Cards */}
        <div className="space-y-4">
          {slides.map((slide, index) => (
            <SlideEditCard
              key={index}
              slide={slide}
              index={index}
              isExpanded={expandedSlide === index}
              onToggleExpand={() => setExpandedSlide(expandedSlide === index ? null : index)}
              onChange={(updated) => handleSlideChange(index, updated)}
              disabled={!isEditable}
            />
          ))}
        </div>

        {slides.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No slides have been generated yet.
          </div>
        )}

        {/* Unsaved changes dialog */}
        <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Are you sure you want to leave?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction onClick={() => navigate(`/instructor/courses/${courseId}`)}>
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </AppShell>
  );
}
