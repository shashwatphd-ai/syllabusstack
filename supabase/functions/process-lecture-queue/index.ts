import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum concurrent generations to prevent rate limiting
const MAX_CONCURRENT = 2;

// Timeout threshold for stuck "generating" records (in minutes)
const STUCK_THRESHOLD_MINUTES = 10;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { action, instructor_course_id, teaching_unit_ids } = body;

    // Get auth from request to identify the user
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // ACTION: queue-bulk - Add multiple teaching units to the queue
    if (action === 'queue-bulk' && teaching_unit_ids?.length > 0) {
      console.log(`[Queue] Bulk queueing ${teaching_unit_ids.length} teaching units`);
      
      // Get teaching unit context for each
      const { data: units, error: unitsError } = await supabase
        .from('teaching_units')
        .select(`
          id, 
          title,
          learning_objective_id,
          learning_objectives!inner(
            instructor_course_id
          )
        `)
        .in('id', teaching_unit_ids);

      if (unitsError) throw unitsError;

      // Check which ones already have slides
      const { data: existingSlides } = await supabase
        .from('lecture_slides')
        .select('teaching_unit_id, status')
        .in('teaching_unit_id', teaching_unit_ids);

      const existingMap = new Map(existingSlides?.map(s => [s.teaching_unit_id, s.status]) || []);
      
      let queuedCount = 0;
      let skippedCount = 0;

      for (const unit of units || []) {
        const existingStatus = existingMap.get(unit.id);
        
        // Skip if already ready, published, or generating
        if (existingStatus === 'ready' || existingStatus === 'published' || existingStatus === 'generating') {
          skippedCount++;
          continue;
        }

        // If pending, already in queue
        if (existingStatus === 'pending') {
          queuedCount++;
          continue;
        }

        // If failed or doesn't exist, queue it
        if (existingStatus === 'failed') {
          // Update existing failed record to pending
          await supabase
            .from('lecture_slides')
            .update({
              status: 'pending',
              error_message: null,
              generation_phases: { 
                queued_at: new Date().toISOString(),
                queued_by: userId,
              },
            })
            .eq('teaching_unit_id', unit.id);
        } else {
          // Create new pending record
          const courseId = (unit.learning_objectives as any)?.instructor_course_id;
          await supabase
            .from('lecture_slides')
            .insert({
              teaching_unit_id: unit.id,
              learning_objective_id: unit.learning_objective_id,
              instructor_course_id: courseId,
              title: unit.title,
              status: 'pending',
              slide_style: 'standard',
              created_by: userId,
              generation_phases: { 
                queued_at: new Date().toISOString(),
                queued_by: userId,
              },
            });
        }
        queuedCount++;
      }

      console.log(`[Queue] Queued ${queuedCount}, skipped ${skippedCount}`);

      // Trigger immediate processing using service role (fire and forget)
      // Pass userId for audit trail but use service role for actual processing
      EdgeRuntime.waitUntil(processQueue(supabase, supabaseUrl, serviceRoleKey, userId));

      return new Response(JSON.stringify({
        success: true,
        queued: queuedCount,
        skipped: skippedCount,
        message: `Queued ${queuedCount} teaching units for slide generation`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: process-next - Process pending items from the queue
    if (action === 'process-next') {
      const result = await processQueue(supabase, supabaseUrl, serviceRoleKey, userId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: get-status - Get queue status for a course
    if (action === 'get-status' && instructor_course_id) {
      const { data: slides, error } = await supabase
        .from('lecture_slides')
        .select('id, teaching_unit_id, status, error_message, updated_at')
        .eq('instructor_course_id', instructor_course_id);

      if (error) throw error;

      const statusCounts = {
        pending: 0,
        generating: 0,
        ready: 0,
        published: 0,
        failed: 0,
      };

      for (const slide of slides || []) {
        const status = slide.status as keyof typeof statusCounts;
        if (status in statusCounts) statusCounts[status]++;
      }

      return new Response(JSON.stringify({
        success: true,
        total: slides?.length || 0,
        ...statusCounts,
        slides,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: cleanup-stuck - Reset stuck "generating" records
    if (action === 'cleanup-stuck') {
      const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
      
      const { data: stuckSlides, error } = await supabase
        .from('lecture_slides')
        .update({
          status: 'pending',
          error_message: 'Reset from stuck generating state - retrying',
          generation_phases: { 
            reset_at: new Date().toISOString(),
            previous_status: 'generating',
          },
        })
        .eq('status', 'generating')
        .lt('updated_at', stuckThreshold)
        .select('id, teaching_unit_id');

      console.log(`[Cleanup] Reset ${stuckSlides?.length || 0} stuck records`);

      return new Response(JSON.stringify({
        success: true,
        reset: stuckSlides?.length || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Invalid action. Use: queue-bulk, process-next, get-status, cleanup-stuck' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Queue] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Process pending items from the queue with controlled concurrency.
 * Uses service role for all operations - no JWT dependency.
 */
async function processQueue(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  initiatingUserId: string | null
): Promise<{ processed: number; remaining: number }> {
  // Check how many are currently generating
  const { data: generating } = await supabase
    .from('lecture_slides')
    .select('id')
    .eq('status', 'generating');

  const currentlyGenerating = generating?.length || 0;
  const slotsAvailable = Math.max(0, MAX_CONCURRENT - currentlyGenerating);

  if (slotsAvailable === 0) {
    console.log(`[Queue] No slots available (${currentlyGenerating}/${MAX_CONCURRENT} generating)`);
    return { processed: 0, remaining: -1 };
  }

  // Get pending items, ordered by created_at
  const { data: pending } = await supabase
    .from('lecture_slides')
    .select('id, teaching_unit_id, created_by')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(slotsAvailable);

  if (!pending || pending.length === 0) {
    console.log('[Queue] No pending items');
    return { processed: 0, remaining: 0 };
  }

  console.log(`[Queue] Processing ${pending.length} items (${slotsAvailable} slots available)`);

  // Get remaining count
  const { count: remainingCount } = await supabase
    .from('lecture_slides')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Process each item
  let processed = 0;
  for (const item of pending) {
    try {
      // Use the original creator's user_id for ownership tracking
      // If not available, use the initiating user or null
      const ownerUserId = item.created_by || initiatingUserId;

      // Call the generation function with SERVICE ROLE and explicit user_id
      // This allows background processing without a user JWT
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-lecture-slides-v3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          teaching_unit_id: item.teaching_unit_id,
          style: 'standard',
          regenerate: false,
          // CRITICAL: Pass user_id explicitly for service role calls
          user_id: ownerUserId,
          _from_queue: true, // Flag to indicate this is a queue call
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Queue] Generation failed for ${item.teaching_unit_id}:`, errorText);
        
        // Mark as failed with error details
        await supabase
          .from('lecture_slides')
          .update({
            status: response.status === 429 ? 'pending' : 'failed',
            error_message: response.status === 429 
              ? 'Rate limited - will retry' 
              : `Generation failed: ${response.status}`,
          })
          .eq('id', item.id);
      } else {
        processed++;
        console.log(`[Queue] Successfully processed ${item.teaching_unit_id}`);
      }
    } catch (err) {
      console.error(`[Queue] Error processing ${item.teaching_unit_id}:`, err);
      
      // Mark as failed on exception
      await supabase
        .from('lecture_slides')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .eq('id', item.id);
    }
  }

  return { 
    processed, 
    remaining: (remainingCount || 0) - processed,
  };
}
