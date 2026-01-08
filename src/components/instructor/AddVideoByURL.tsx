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

  const extractVideoId = (inputUrl: string): { id: string; source: 'youtube' | 'khan_academy' } | null => {
    // YouTube patterns
    const youtubePatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];
    
    for (const pattern of youtubePatterns) {
      const match = inputUrl.match(pattern);
      if (match) return { id: match[1], source: 'youtube' };
    }

    // Khan Academy patterns
    const khanPatterns = [
      /khanacademy\.org\/(?:video|v)\/([^/?#]+)/,
      /khanacademy\.org\/.*\/v\/([^/?#]+)/,
    ];
    
    for (const pattern of khanPatterns) {
      const match = inputUrl.match(pattern);
      if (match) return { id: match[1], source: 'khan_academy' };
    }
    
    return null;
  };

  const handleFetchMetadata = async () => {
    const videoInfo = extractVideoId(url);
    if (!videoInfo) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid YouTube or Khan Academy URL',
        variant: 'destructive',
      });
      return;
    }

    setIsFetching(true);
    try {
      if (videoInfo.source === 'youtube') {
        const { data, error } = await supabase.functions.invoke('fetch-video-metadata', {
          body: { video_id: videoInfo.id },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Failed to fetch video');
        
        setMetadata({ ...data.metadata, source_type: 'youtube' });
      } else if (videoInfo.source === 'khan_academy') {
        // Fetch Khan Academy oEmbed data
        const oembedUrl = `https://www.khanacademy.org/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oembedUrl);
        
        if (!response.ok) {
          throw new Error('Failed to fetch Khan Academy video details');
        }
        
        const oembed = await response.json();
        
        setMetadata({
          video_id: videoInfo.id,
          title: oembed.title || videoInfo.id,
          description: `Khan Academy video by ${oembed.author_name || 'Sal Khan'}`,
          channel_name: 'Khan Academy',
          thumbnail_url: oembed.thumbnail_url || '',
          duration_seconds: 600, // Default estimate
          view_count: 0,
          published_at: new Date().toISOString(),
          source_type: 'khan_academy',
        } as VideoMetadata & { source_type: string });
      }
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

    const sourceType = (metadata as any).source_type || 'youtube';
    const sourceUrl = sourceType === 'khan_academy' 
      ? url 
      : `https://www.youtube.com/watch?v=${metadata.video_id}`;

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
          source_type: sourceType,
          source_url: sourceUrl,
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
            Paste a YouTube or Khan Academy URL to add it to this learning objective
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Video URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                placeholder="https://youtube.com/watch?v=... or khanacademy.org/video/..."
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