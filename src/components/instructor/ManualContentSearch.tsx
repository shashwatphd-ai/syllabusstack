import { useState } from 'react';
import { Search, Loader2, Plus, ExternalLink, Video, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ManualContentSearchProps {
  learningObjectiveId: string;
  learningObjectiveText: string;
  onContentAdded?: () => void;
}

interface YouTubeSearchResult {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
  viewCount: string;
  publishedAt: string;
}

export function ManualContentSearch({ learningObjectiveId, learningObjectiveText, onContentAdded }: ManualContentSearchProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-youtube-manual', {
        body: { query: query.trim() },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setResults(data.results || []);
      
      if (data.results?.length === 0) {
        toast({
          title: 'No results found',
          description: 'Try different search terms',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleAddVideo = async (video: YouTubeSearchResult) => {
    setAdding(video.id);
    try {
      const { data, error } = await supabase.functions.invoke('add-manual-content', {
        body: {
          learning_objective_id: learningObjectiveId,
          video_id: video.id,
          video_title: video.title,
          video_description: video.description,
          channel_name: video.channelTitle,
          thumbnail_url: video.thumbnailUrl,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      toast({
        title: 'Video added!',
        description: 'The video has been added to this learning objective',
      });
      
      // Remove from results
      setResults(prev => prev.filter(r => r.id !== video.id));
      onContentAdded?.();
    } catch (error) {
      console.error('Add video error:', error);
      toast({
        title: 'Failed to add video',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAdding(null);
    }
  };

  const formatDuration = (duration: string) => {
    // Parse ISO 8601 duration (e.g., PT4M13S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatViews = (count: string) => {
    const num = parseInt(count);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return count;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Search className="h-3.5 w-3.5" />
          Search Manually
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search YouTube Content</DialogTitle>
          <DialogDescription className="line-clamp-2">
            Find videos for: {learningObjectiveText}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-2 py-2">
          <Input
            placeholder="Search for educational videos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {results.length === 0 && !searching && (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Search for videos to add to this learning objective</p>
            </div>
          )}
          
          {searching && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground mt-2">Searching YouTube...</p>
            </div>
          )}

          {results.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <div className="flex">
                {/* Thumbnail */}
                <div className="relative w-40 h-24 flex-shrink-0">
                  <img 
                    src={video.thumbnailUrl} 
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  {video.duration && (
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-white text-xs rounded">
                      {formatDuration(video.duration)}
                    </span>
                  )}
                </div>

                {/* Info */}
                <CardContent className="flex-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{video.channelTitle}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatViews(video.viewCount)} views</span>
                        <a 
                          href={`https://www.youtube.com/watch?v=${video.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Preview
                        </a>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleAddVideo(video)}
                      disabled={adding === video.id}
                      className="gap-1"
                    >
                      {adding === video.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Add
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
