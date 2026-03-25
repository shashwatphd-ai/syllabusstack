import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Generic reusable hook for Supabase Realtime subscriptions.
 * Subscribes to postgres_changes on mount, throttles query invalidations,
 * and cleans up on unmount.
 *
 * Pattern based on existing lectureSlides/queries.ts (lines 77-143).
 *
 * @param channelName - Unique channel name
 * @param table - Table to subscribe to
 * @param filter - Optional filter string (e.g., "student_id=eq.xxx")
 * @param queryKeysToInvalidate - Array of query key arrays to invalidate on changes
 * @param throttleMs - Throttle interval for invalidations (default 5000ms)
 * @param enabled - Whether to enable the subscription (default true)
 */
export function useRealtimeChannel(
  channelName: string,
  table: string,
  filter: string | undefined,
  queryKeysToInvalidate: readonly (readonly unknown[])[],
  throttleMs: number = 5000,
  enabled: boolean = true
) {
  const queryClient = useQueryClient();
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInvalidation = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !channelName) return;

    // Check for duplicate channels
    const existingChannels = supabase.getChannels();
    if (existingChannels.some(ch => ch.topic === `realtime:${channelName}`)) {
      return;
    }

    const throttledInvalidate = () => {
      const now = Date.now();
      const timeSinceLast = now - lastInvalidation.current;

      if (timeSinceLast >= throttleMs) {
        lastInvalidation.current = now;
        for (const keys of queryKeysToInvalidate) {
          queryClient.invalidateQueries({ queryKey: [...keys] });
        }
      } else if (!pendingTimeout.current) {
        pendingTimeout.current = setTimeout(() => {
          lastInvalidation.current = Date.now();
          pendingTimeout.current = null;
          for (const keys of queryKeysToInvalidate) {
            queryClient.invalidateQueries({ queryKey: [...keys] });
          }
        }, throttleMs - timeSinceLast);
      }
    };

    const subscriptionConfig: any = {
      event: '*',
      schema: 'public',
      table,
    };
    if (filter) {
      subscriptionConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', subscriptionConfig, throttledInvalidate)
      .subscribe();

    return () => {
      if (pendingTimeout.current) {
        clearTimeout(pendingTimeout.current);
        pendingTimeout.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [channelName, table, filter, enabled, queryClient, throttleMs]);
}
