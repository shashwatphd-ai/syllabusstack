import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to get authenticated URLs for private storage buckets.
 * Creates signed URLs that work with RLS policies.
 */
export function useStorageUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn: number = 3600 // 1 hour default
) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }

    // Check if it's already a full URL (external or legacy)
    if (path.startsWith('http://') || path.startsWith('https://')) {
      // Extract path from Supabase storage URL if it's from our bucket
      const bucketPattern = `/storage/v1/object/public/${bucket}/`;
      if (path.includes(bucketPattern)) {
        const extractedPath = path.split(bucketPattern)[1];
        if (extractedPath) {
          fetchSignedUrl(extractedPath);
          return;
        }
      }
      // For external URLs, use directly
      setSignedUrl(path);
      return;
    }

    fetchSignedUrl(path);

    async function fetchSignedUrl(storagePath: string) {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, expiresIn);

        if (signError) {
          console.error(`Error creating signed URL for ${bucket}/${storagePath}:`, signError);
          setError(signError.message);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error(`Error fetching signed URL:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setSignedUrl(null);
      } finally {
        setIsLoading(false);
      }
    }
  }, [bucket, path, expiresIn]);

  return { signedUrl, isLoading, error };
}

/**
 * Extract the storage path from a full Supabase URL
 */
export function extractStoragePath(url: string, bucket: string): string | null {
  if (!url) return null;
  
  const bucketPattern = `/storage/v1/object/public/${bucket}/`;
  if (url.includes(bucketPattern)) {
    return url.split(bucketPattern)[1] || null;
  }
  
  // Check for signed URL pattern
  const signedPattern = `/storage/v1/object/sign/${bucket}/`;
  if (url.includes(signedPattern)) {
    const pathPart = url.split(signedPattern)[1];
    // Remove query params (token, etc.)
    return pathPart?.split('?')[0] || null;
  }
  
  return null;
}

/**
 * Batch create signed URLs for multiple paths
 */
export async function createSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn: number = 3600
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  
  if (paths.length === 0) return urlMap;
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);
  
  if (error) {
    console.error(`Error creating batch signed URLs:`, error);
    return urlMap;
  }
  
  data?.forEach((item, index) => {
    if (item.signedUrl) {
      urlMap.set(paths[index], item.signedUrl);
    }
  });
  
  return urlMap;
}
