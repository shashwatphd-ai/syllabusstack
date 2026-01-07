import { useState } from 'react';
import { Search, Video, Loader2, Plus, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface ManualContentSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learningObjectiveId: string;
  learningObjectiveText: string;
}

interface YouTubeResult {
  video_id: string;
  title: string;
  description: string;
  channel_name: string;
  thumbnail_url: string;
  duration_seconds: number;
  view_count: number;
  published_at: string;
}

export function ManualContentSearch({ 
  open, 
  onOpenChange, 
  learningObjectiveId,
  learningObjectiveText 
}: ManualContentSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-youtube-manual', {
        body: { query: query.trim(), max_results: 10 },
      });

      if (error) throw error;
      setResults(data.results || []);
    } catch (error) {
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : 'Failed to search YouTube',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddVideo = async (video: YouTubeResult) => {
    setIsAdding(video.video_id);
    try {
      const { data, error } = await supabase.functions.invoke('add-manual-content', {
        body: {
          learning_objective_id: learningObjectiveId,
          video_id: video.video_id,
          title: video.title,
          description: video.description,
          channel_name: video.channel_name,
          thumbnail_url: video.thumbnail_url,
          duration_seconds: video.duration_seconds,
          view_count: video.view_count,
          published_at: video.published_at,
        },
      });

      if (error) throw error;

      toast({
        title: 'Video Added',
        description: 'The video has been added and is pending review',
      });

      // Remove from results
      setResults(prev => prev.filter(r => r.video_id !== video.video_id));
      
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
      setIsAdding(null);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (count: number | null) => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search YouTube Videos</DialogTitle>
          <DialogDescription className="line-clamp-2">
            Find videos for: {learningObjectiveText}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Search YouTube..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={isSearching} className="gap-2">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mt-4">
          {results.length === 0 && !isSearching && (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Search for videos to add to this learning objective</p>
            </div>
          )}

          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {results.map((video) => (
            <div 
              key={video.video_id}
              className="flex gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="relative w-32 h-20 flex-shrink-0 rounded overflow-hidden">
                <img 
                  src={video.thumbnail_url} 
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-white text-xs rounded">
                  {formatDuration(video.duration_seconds)}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{video.channel_name}</p>
                <p className="text-xs text-muted-foreground">{formatViews(video.view_count)} views</p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAddVideo(video)}
                  disabled={isAdding === video.video_id}
                  className="gap-1.5"
                >
                  {isAdding === video.video_id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a 
                    href={`https://youtube.com/watch?v=${video.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}