import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

export interface SearchResult {
  id: string;
  type: 'course' | 'dream_job' | 'recommendation' | 'capability';
  title: string;
  subtitle?: string;
  url: string;
}

async function performSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const { data, error } = await supabase.functions.invoke('global-search', {
    body: { query: query.trim() },
  });

  if (error) {
    console.error('Search error:', error);
    throw error;
  }

  return data?.results || [];
}

export function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => performSearch(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearSearch,
    hasResults: results.length > 0,
  };
}
