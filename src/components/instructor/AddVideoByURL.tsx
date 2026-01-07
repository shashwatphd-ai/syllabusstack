import { useState } from 'react';
import { Link, Loader2, Video, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AddVideoByURLProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learningObjectiveId: string;
}

interface VideoMetadata {
  video_id: string;
  title: string;
  description: string;
  channel_name: string;
  thumbnail_url: string;
  duration_seconds: number;
  view_count: number;
  published_at: string;
}

export function AddVideoByURL({ open, onOpenChange, learningObjectiveId }: AddVideoByURLProps) {
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const extractVideoId = (inputUrl: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = inputUrl.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  };

  const handleFetchMetadata = async () => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid YouTube URL',
        variant: 'destructive',
      });
      return;
    }

    setIsFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-video-metadata', {
        body: { video_id: videoId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to fetch video');
      
      setMetadata(data.metadata);
    } catch (error) {
      toast({
        title: 'Failed to Fetch Video',
        description: error instanceof Error ? error.message : 'Could not fetch video details',
        variant: 'destructive',
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleAddVideo = async () => {
    if (!metadata) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke('add-manual-content', {
        body: {
          learning_objective_id: learningObjectiveId,
          video_id: metadata.video_id,
          title: metadata.title,
          description: metadata.description,
          channel_name: metadata.channel_name,
          thumbnail_url: metadata.thumbnail_url,
          duration_seconds: metadata.duration_seconds,
          view_count: metadata.view_count,
          published_at: metadata.published_at,
        },
      });

      if (error) throw error;

      toast({
        title: 'Video Added',
        description: 'The video has been added and is pending review',
      });

      // Reset and close
      setUrl('');
      setMetadata(null);
      onOpenChange(false);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['content-matches', learningObjectiveId] });
      queryClient.invalidateQueries({ queryKey: ['lo-content-status'] });
      queryClient.invalidateQueries({ queryKey: ['content-stats'] });

    } catch (error) {
      toast({
        title: 'Failed to Add Video',
        description: error instanceof Error ? error.message : 'Failed to add video',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setUrl('');
        setMetadata(null);
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Video by URL</DialogTitle>
          <DialogDescription>
            Paste a YouTube URL to add it to this learning objective
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">YouTube URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button 
                onClick={handleFetchMetadata} 
                disabled={isFetching || !url.trim()}
                variant="outline"
              >
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Fetch'
                )}
              </Button>
            </div>
          </div>

          {metadata && (
            <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
              <div className="flex gap-3">
                <div className="relative w-24 h-14 flex-shrink-0 rounded overflow-hidden">
                  <img 
                    src={metadata.thumbnail_url} 
                    alt={metadata.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/80 text-white text-[10px] rounded">
                    {formatDuration(metadata.duration_seconds)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-2">{metadata.title}</p>
                  <p className="text-xs text-muted-foreground">{metadata.channel_name}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddVideo} 
            disabled={isAdding || !metadata}
            className="gap-2"
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Add Video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}