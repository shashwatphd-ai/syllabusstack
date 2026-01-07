import { useState } from 'react';
import { Link, Loader2, Plus, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AddVideoByURLProps {
  learningObjectiveId: string;
  onContentAdded?: () => void;
}

export function AddVideoByURL({ learningObjectiveId, onContentAdded }: AddVideoByURLProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    title: string;
    channelName: string;
    thumbnailUrl: string;
    duration: string;
  } | null>(null);

  const extractVideoId = (input: string): string | null => {
    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\/\s]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleFetchPreview = async () => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid YouTube URL or video ID',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-video-metadata', {
        body: { video_id: videoId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setPreview({
        title: data.title,
        channelName: data.channel_name,
        thumbnailUrl: data.thumbnail_url,
        duration: data.duration,
      });
    } catch (error) {
      console.error('Fetch preview error:', error);
      toast({
        title: 'Failed to fetch video',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddVideo = async () => {
    const videoId = extractVideoId(url);
    if (!videoId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('add-manual-content', {
        body: {
          learning_objective_id: learningObjectiveId,
          video_id: videoId,
          video_title: preview?.title,
          channel_name: preview?.channelName,
          thumbnail_url: preview?.thumbnailUrl,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      toast({
        title: 'Video added!',
        description: 'The video has been added and is pending review',
      });
      
      setOpen(false);
      setUrl('');
      setPreview(null);
      onContentAdded?.();
    } catch (error) {
      console.error('Add video error:', error);
      toast({
        title: 'Failed to add video',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration: string) => {
    const match = duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setUrl(''); setPreview(null); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Link className="h-3.5 w-3.5" />
          Add by URL
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Video by URL</DialogTitle>
          <DialogDescription>
            Paste a YouTube video URL or video ID to add it to this learning objective
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="video-url">YouTube URL or Video ID</Label>
            <div className="flex gap-2">
              <Input
                id="video-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button 
                variant="outline" 
                onClick={handleFetchPreview}
                disabled={loading || !url.trim()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Preview'}
              </Button>
            </div>
          </div>

          {preview && (
            <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
              {preview.thumbnailUrl ? (
                <img 
                  src={preview.thumbnailUrl} 
                  alt={preview.title}
                  className="w-32 h-20 object-cover rounded"
                />
              ) : (
                <div className="w-32 h-20 bg-muted flex items-center justify-center rounded">
                  <Video className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-2">{preview.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{preview.channelName}</p>
                {preview.duration && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Duration: {formatDuration(preview.duration)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddVideo}
            disabled={loading || !preview}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
