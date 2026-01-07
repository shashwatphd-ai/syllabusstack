import { supabase } from '@/integrations/supabase/client';

export interface YouTubeSearchResponse {
  matches: Array<{
    content_id: string;
    title: string;
    match_score: number;
  }>;
  total_found: number;
  auto_approved_count: number;
  error?: string;
}

export async function searchYouTubeContent(
  learningObjectiveId: string,
  searchQuery: string
): Promise<YouTubeSearchResponse> {
  const { data, error } = await supabase.functions.invoke('search-youtube-content', {
    body: { 
      learning_objective_id: learningObjectiveId, 
      query: searchQuery 
    }
  });
  
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  
  return data;
}
