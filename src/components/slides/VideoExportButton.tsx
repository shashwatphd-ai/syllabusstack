import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  renderLectureVideo,
  type VideoSlide,
  type VideoBranding,
  type ExportProgress,
} from '@/lib/videoExporter';
import type { Slide, EnhancedSlide, ProfessorSlide } from '@/hooks/useLectureSlides';

const ALL_VOICES = ['Charon', 'Leda', 'Fenrir', 'Kore', 'Puck', 'Aoede'] as const;

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
  const [currentVoiceLabel, setCurrentVoiceLabel] = useState('');
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [totalVoices, setTotalVoices] = useState(0);
  const [chapterMarkers, setChapterMarkers] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!hasAudio) {
      toast.error('Generate audio first before exporting video');
      return;
    }

    setExporting(true);

    try {
      // Detect all voices that have audio across slides
      const availableVoices = ALL_VOICES.filter((voice) =>
        slides.some((s: any) => {
          const audioUrls = s.audio_urls as Record<string, string> | undefined;
          return audioUrls?.[voice];
        })
      );

      // Fallback: if no multi-voice data, use the selected voice only
      const voicesToExport = availableVoices.length > 0 ? availableVoices : [selectedVoice];
      setTotalVoices(voicesToExport.length);

      let lastChapterMarkers = '';

      for (let vi = 0; vi < voicesToExport.length; vi++) {
        const voice = voicesToExport[vi];
        setVoiceIndex(vi + 1);
        setCurrentVoiceLabel(voice);

        const videoSlides: VideoSlide[] = slides.map((s: any) => {
          const audioUrls = s.audio_urls as Record<string, string> | undefined;
          const audioUrl = audioUrls?.[voice] || s.audio_url;
          const imageUrl = s.visual?.url || s.image_url || s.imageUrl || '';

          return {
            title: s.title,
            imageUrl,
            audioUrl: audioUrl || undefined,
            durationSeconds: s.audio_duration_seconds || s.estimated_seconds || 30,
            speakerNotes: s.speaker_notes || s.notes || '',
            content: s.content || undefined,
            segmentMap: s.audio_segment_map || undefined,
          };
        });

        const result = await renderLectureVideo(videoSlides, branding, voice, (p) => {
          setProgress(p);
        });

        // Download the video
        const url = URL.createObjectURL(result.videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename.replace('.webm', `_${voice}.webm`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        lastChapterMarkers = result.chapterMarkers;
      }

      setChapterMarkers(lastChapterMarkers);
      toast.success(
        voicesToExport.length > 1
          ? `${voicesToExport.length} voice videos exported!`
          : 'Video exported! Chapter markers are ready to copy.'
      );
    } catch (err) {
      console.error('Video export failed:', err);
      toast.error('Video export failed. Please try again.');
    } finally {
      setExporting(false);
      setCurrentVoiceLabel('');
      setVoiceIndex(0);
      setTotalVoices(0);
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
            {totalVoices > 1 && `[${voiceIndex}/${totalVoices} ${currentVoiceLabel}] `}
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
        title={hasAudio ? 'Download branded videos for all voices' : 'Generate audio first'}
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