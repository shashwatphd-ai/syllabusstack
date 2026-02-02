import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";
import { validateRequest, trackConsumptionSchema } from "../_shared/validators/index.ts";

interface WatchedSegment {
  start: number;
  end: number;
}

interface ConsumptionEvent {
  type: "play" | "pause" | "seek" | "speed_change" | "tab_focus_loss" | "complete";
  timestamp: number;
  video_time: number;
  data?: any;
}

function mergeSegments(segments: WatchedSegment[]): WatchedSegment[] {
  if (segments.length === 0) return [];
  
  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  
  const merged: WatchedSegment[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    // If current segment overlaps or is adjacent to last, merge them
    if (current.start <= last.end + 1) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

function calculateWatchPercentage(segments: WatchedSegment[], totalDuration: number): number {
  if (totalDuration === 0) return 0;
  
  const merged = mergeSegments(segments);
  const watchedSeconds = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
  
  return Math.min((watchedSeconds / totalDuration) * 100, 100);
}

function calculateEngagementScore(
  watchPercentage: number,
  microCheckAccuracy: number,
  tabFocusLosses: number,
  rewindCount: number,
  speedViolations: number
): { total: number; breakdown: { time: number; microCheck: number; interaction: number } } {
  // Component 1: Time on Content (40%)
  let timeScore = 0;
  if (watchPercentage >= 85) {
    timeScore = 1.0;
  } else {
    timeScore = watchPercentage / 85;
  }
  
  // Component 2: Micro-Check Accuracy (40%)
  const microCheckScore = microCheckAccuracy;
  
  // Component 3: Interaction Signals (20%)
  // Tab Focus (max 10 points)
  let tabFocusPoints = 10;
  if (tabFocusLosses >= 6) tabFocusPoints = 0;
  else if (tabFocusLosses >= 3) tabFocusPoints = 4;
  else if (tabFocusLosses >= 1) tabFocusPoints = 7;
  
  // Rewind Patterns (max 5 points)
  let rewindPoints = 3; // Default for no rewinds
  if (rewindCount >= 1 && rewindCount <= 5) rewindPoints = 5;
  else if (rewindCount > 5) rewindPoints = 2;
  
  // Speed Violations (max 5 points)
  const speedPoints = Math.max(0, 5 - speedViolations);
  
  const interactionScore = (tabFocusPoints + rewindPoints + speedPoints) / 20;
  
  // Final weighted score
  const total = (timeScore * 0.4 + microCheckScore * 0.4 + interactionScore * 0.2) * 100;
  
  return {
    total,
    breakdown: {
      time: timeScore,
      microCheck: microCheckScore,
      interaction: interactionScore,
    },
  };
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("UNAUTHORIZED", corsHeaders, "No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    const validation = validateRequest(trackConsumptionSchema, body);
    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', corsHeaders, validation.errors.join(', '));
    }
    const {
      content_id,
      learning_objective_id,
      event,
      current_segments,
      total_duration,
      micro_check_results,
    } = validation.data;

    console.log(`Processing consumption event for content: ${content_id}, event type: ${event?.type}`);

    // Get or create consumption record
    // Note: .eq() doesn't work with null values, need to use .is() for NULL comparison
    let query = supabaseClient
      .from("consumption_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("content_id", content_id);

    // Handle null/undefined learning_objective_id properly
    if (learning_objective_id) {
      query = query.eq("learning_objective_id", learning_objective_id);
    } else {
      query = query.is("learning_objective_id", null);
    }

    let { data: record, error: fetchError } = await query.maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Fetch error:", fetchError);
      throw new Error(fetchError.message || `Database error: ${fetchError.code}`);
    }

    const now = new Date().toISOString();
    const consumptionEvent: ConsumptionEvent = event;

    if (!record) {
      // Create new record
      const { data: newRecord, error: createError } = await supabaseClient
        .from("consumption_records")
        .insert({
          user_id: user.id,
          content_id,
          learning_objective_id,
          started_at: now,
          watched_segments: [],
          tab_focus_losses: [],
          rewind_events: [],
        })
        .select()
        .single();

      if (createError) {
        console.error("Create error:", createError);
        throw new Error(createError.message || `Failed to create consumption record: ${createError.code}`);
      }
      record = newRecord;
    }

    // Process the event
    const updates: any = { updated_at: now };

    if (consumptionEvent) {
      switch (consumptionEvent.type) {
        case "play":
          if (!record.started_at) {
            updates.started_at = now;
          }
          break;

        case "pause":
          // Update current position
          updates.current_position_seconds = consumptionEvent.video_time;
          break;

        case "seek":
          // Record rewind if seeking backward
          if (consumptionEvent.data?.from > consumptionEvent.data?.to) {
            const rewindEvents = [...(record.rewind_events || [])];
            rewindEvents.push({
              from: consumptionEvent.data.from,
              to: consumptionEvent.data.to,
              timestamp: consumptionEvent.timestamp,
            });
            updates.rewind_events = rewindEvents;
          }
          break;

        case "speed_change":
          if (consumptionEvent.data?.speed > 2) {
            updates.playback_speed_violations = (record.playback_speed_violations || 0) + 1;
          }
          break;

        case "tab_focus_loss":
          const focusLosses = [...(record.tab_focus_losses || [])];
          focusLosses.push({
            time: consumptionEvent.video_time,
            timestamp: consumptionEvent.timestamp,
          });
          updates.tab_focus_losses = focusLosses;
          break;

        case "complete":
          updates.completed_at = now;
          break;
      }
    }

    // Update watched segments if provided
    if (current_segments && Array.isArray(current_segments)) {
      updates.watched_segments = current_segments;
      
      if (total_duration && total_duration > 0) {
        updates.watch_percentage = calculateWatchPercentage(current_segments, total_duration);
        updates.total_watch_time_seconds = current_segments.reduce(
          (sum: number, seg: WatchedSegment) => sum + (seg.end - seg.start), 
          0
        );
      }
    }

    // Calculate micro-check accuracy if results provided
    if (micro_check_results && Array.isArray(micro_check_results)) {
      const firstAttempts = micro_check_results.filter((r: any) => r.attempt_number === 1);
      if (firstAttempts.length > 0) {
        const correctCount = firstAttempts.filter((r: any) => r.is_correct).length;
        updates.micro_check_accuracy_score = correctCount / firstAttempts.length;
      }
    }

    // Calculate engagement score if we have enough data
    if (updates.watch_percentage !== undefined || record.watch_percentage) {
      const watchPct = updates.watch_percentage ?? record.watch_percentage ?? 0;
      const microCheckAcc = updates.micro_check_accuracy_score ?? record.micro_check_accuracy_score ?? 0;
      const focusLosses = (updates.tab_focus_losses ?? record.tab_focus_losses ?? []).length;
      const rewindCount = (updates.rewind_events ?? record.rewind_events ?? []).length;
      const speedViolations = updates.playback_speed_violations ?? record.playback_speed_violations ?? 0;

      const engagement = calculateEngagementScore(
        watchPct,
        microCheckAcc,
        focusLosses,
        rewindCount,
        speedViolations
      );

      updates.time_on_content_score = engagement.breakdown.time;
      updates.interaction_signals_score = engagement.breakdown.interaction;
      updates.engagement_score = engagement.total;
      
      // Check if verified (score >= 70)
      if (engagement.total >= 70) {
        updates.is_verified = true;
        
        // Update learning objective state if not already verified
        if (learning_objective_id) {
          await supabaseClient
            .from("learning_objectives")
            .update({ verification_state: "verified" })
            .eq("id", learning_objective_id)
            .eq("verification_state", "in_progress");
        }
      }
    }

    // Update the record
    const { data: updatedRecord, error: updateError } = await supabaseClient
      .from("consumption_records")
      .update(updates)
      .eq("id", record.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(updateError.message || `Failed to update consumption record: ${updateError.code}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        consumption_record: updatedRecord,
        is_verified: updatedRecord.is_verified,
        engagement_score: updatedRecord.engagement_score,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    logError("track-consumption", error instanceof Error ? error : new Error(String(error)), { action: "tracking" });

    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object') {
      const err = error as { message?: string; code?: string; details?: string; hint?: string };
      errorMessage = err.message || err.details || err.hint || JSON.stringify(error);
      if (err.code) {
        errorMessage = `[${err.code}] ${errorMessage}`;
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return createErrorResponse("INTERNAL_ERROR", corsHeaders, errorMessage);
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
