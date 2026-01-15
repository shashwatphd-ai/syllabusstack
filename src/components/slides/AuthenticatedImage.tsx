import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthenticatedImageProps {
  src: string | undefined;
  alt: string;
  className?: string;
  fallbackText?: string;
  bucket?: string;
  onSignedUrlReady?: (url: string) => void; // Callback to pass signed URL to parent for lightbox
}

/**
 * Image component that handles private Supabase storage buckets.
 * Automatically creates signed URLs for authenticated access.
 */
export function AuthenticatedImage({ 
  src, 
  alt, 
  className, 
  fallbackText,
  bucket = 'lecture-visuals',
  onSignedUrlReady
}: AuthenticatedImageProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    // Extract path from full URL if needed
    const storagePath = extractPathFromUrl(src, bucket);
    
    if (!storagePath) {
      // External URL or invalid - try using directly
      setSignedUrl(src);
      onSignedUrlReady?.(src);
      setIsLoading(false);
      return;
    }

    // Create signed URL for private bucket access
    createSignedUrl(storagePath);

    async function createSignedUrl(path: string) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (error) {
          console.error('Failed to create signed URL:', error);
          // Fall back to original URL
          setSignedUrl(src!);
          onSignedUrlReady?.(src!);
        } else {
          setSignedUrl(data.signedUrl);
          onSignedUrlReady?.(data.signedUrl);
        }
      } catch (err) {
        console.error('Error creating signed URL:', err);
        setSignedUrl(src!);
        onSignedUrlReady?.(src!);
      } finally {
        setIsLoading(false);
      }
    }
  }, [src, bucket]);

  if (isLoading) {
    return <Skeleton className={className} />;
  }

  if (hasError || !signedUrl) {
    if (fallbackText) {
      return (
        <div className={`${className} flex items-center justify-center bg-muted/50 text-muted-foreground text-sm p-4`}>
          💡 {fallbackText}
        </div>
      );
    }
    return null;
  }

  return (
    <img 
      src={signedUrl} 
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

/**
 * Extract storage path from a full Supabase URL
 */
function extractPathFromUrl(url: string, bucket: string): string | null {
  if (!url) return null;
  
  // Check if it's a relative path (just the filename)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }
  
  // Pattern for public URLs
  const publicPattern = `/storage/v1/object/public/${bucket}/`;
  if (url.includes(publicPattern)) {
    return url.split(publicPattern)[1] || null;
  }
  
  // Pattern for signed URLs (already authenticated)
  const signedPattern = `/storage/v1/object/sign/${bucket}/`;
  if (url.includes(signedPattern)) {
    // Already a signed URL - use directly
    return null;
  }
  
  // External URL - not our bucket
  return null;
}
