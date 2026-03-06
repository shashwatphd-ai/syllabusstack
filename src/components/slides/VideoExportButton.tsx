import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  renderLectureVideo,
  type VideoSlide,
  type VideoBranding,
  type ExportProgress,
} from '@/lib/videoExporter';
import type { Slide, EnhancedSlide, ProfessorSlide } from '@/hooks/useLectureSlides';

interface VideoExportButtonProps {
  slides: (Slide | EnhancedSlide | ProfessorSlide)[];
  branding: VideoBranding;
  selectedVoice: string;
  hasAudio: boolean;
  disabled?: boolean;
}

export function VideoExportButton({
  slides,
  branding,
  selectedVoice,
  hasAudio,
  disabled,
}: VideoExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [chapterMarkers, setChapterMarkers] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!hasAudio) {
      toast.error('Generate audio first before exporting video');
      return;
    }

    setExporting(true);
    setProgress({ phase: 'preparing', currentSlide: 0, totalSlides: slides.length, percent: 0 });

    try {
      // Map slides to VideoSlide format
      const videoSlides: VideoSlide[] = slides.map((s: any) => {
        const audioUrls = s.audio_urls as Record<string, string> | undefined;
        const audioUrl = audioUrls?.[selectedVoice] || s.audio_url;

        return {
          title: s.title,
          imageUrl: s.image_url || s.imageUrl || '',
          audioUrl: audioUrl || undefined,
          durationSeconds: s.audio_duration_seconds || s.estimated_seconds || 30,
          speakerNotes: s.speaker_notes || s.notes || '',
        };
      });

      const result = await renderLectureVideo(videoSlides, branding, selectedVoice, setProgress);

      // Download the video
      const url = URL.createObjectURL(result.videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setChapterMarkers(result.chapterMarkers);
      toast.success('Video exported! Chapter markers are ready to copy.');
    } catch (err) {
      console.error('Video export failed:', err);
      toast.error('Video export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [slides, branding, selectedVoice, hasAudio]);

  const copyChapters = useCallback(() => {
    if (chapterMarkers) {
      navigator.clipboard.writeText(chapterMarkers);
      toast.success('YouTube chapter markers copied to clipboard!');
    }
  }, [chapterMarkers]);

  if (exporting && progress) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-xs">
            {progress.phase === 'preparing' && `Loading ${progress.currentSlide}/${progress.totalSlides}...`}
            {progress.phase === 'rendering' && `Rendering ${progress.currentSlide}/${progress.totalSlides}...`}
            {progress.phase === 'encoding' && 'Encoding...'}
          </span>
        </Badge>
        <Progress value={progress.percent} className="w-20 h-2" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={disabled || !hasAudio}
        title={hasAudio ? 'Download branded video for YouTube' : 'Generate audio first'}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Video</span>
      </Button>

      {chapterMarkers && (
        <Button
          variant="ghost"
          size="sm"
          onClick={copyChapters}
          title="Copy YouTube chapter markers"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
