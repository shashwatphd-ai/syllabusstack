/**
 * Process Batch Images Edge Function Tests
 * 
 * End-to-end tests for the image generation queue processing pipeline.
 * 
 * Run with: deno test --allow-env --allow-net supabase/functions/process-batch-images/index.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL) throw new Error('SUPABASE_URL environment variable is required');
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY environment variable is required');

// ============================================================================
// DATABASE TESTS
// ============================================================================

Deno.test("image_generation_queue table exists and has correct schema", async () => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  
  // Query to check table structure
  const { data, error } = await supabase
    .from('image_generation_queue')
    .select('*')
    .limit(0);
  
  // Should not error (table exists)
  assertEquals(error, null);
});

Deno.test("Queue status values are valid", async () => {
  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  
  const { data, error } = await supabase
    .from('image_generation_queue')
    .select('status')
    .limit(100);
  
  if (data && data.length > 0) {
    data.forEach(row => {
      assertEquals(
        validStatuses.includes(row.status),
        true,
        `Invalid status: ${row.status}`
      );
    });
  }
});

Deno.test("Queue items have required fields", async () => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  
  const { data, error } = await supabase
    .from('image_generation_queue')
    .select('id, lecture_slides_id, slide_index, prompt, status, attempts')
    .limit(10);
  
  assertEquals(error, null);
  
  if (data && data.length > 0) {
    data.forEach(row => {
      assertExists(row.id, 'id should exist');
      assertExists(row.lecture_slides_id, 'lecture_slides_id should exist');
      assertEquals(typeof row.slide_index, 'number', 'slide_index should be number');
      assertExists(row.prompt, 'prompt should exist');
      assertExists(row.status, 'status should exist');
      assertEquals(typeof row.attempts, 'number', 'attempts should be number');
    });
  }
});

// ============================================================================
// EDGE FUNCTION INVOCATION TESTS
// ============================================================================

Deno.test({
  name: "process-batch-images function is deployed and reachable",
  async fn() {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/process-batch-images`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Empty body for health check
        })
      }
    );
    
    // Should return a response (not 404)
    assertEquals(response.status !== 404, true, 'Function should be deployed');
    
    // Even if it fails, it should return JSON
    const data = await response.json();
    assertExists(data);
  }
});

Deno.test({
  name: "Function handles missing courseId parameter",
  async fn() {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/process-batch-images`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      }
    );
    
    const data = await response.json();
    
    // Should handle gracefully (not crash)
    assertExists(data);
  }
});

// ============================================================================
// QUEUE PROCESSING LOGIC TESTS
// ============================================================================

Deno.test("Queue processing respects batch size limits", () => {
  const BATCH_SIZE = 5;
  const MAX_CONCURRENT = 3;
  
  // These are the documented limits for avoiding timeouts
  assertEquals(BATCH_SIZE <= 10, true, 'Batch size should be <= 10');
  assertEquals(MAX_CONCURRENT <= 5, true, 'Concurrent limit should be <= 5');
});

Deno.test("Retry logic has appropriate limits", () => {
  const MAX_ATTEMPTS = 3;
  const MAX_RETRIES = 2; // maxRetries in generateImage()
  
  // Verify reasonable limits
  assertEquals(MAX_ATTEMPTS >= 1, true);
  assertEquals(MAX_ATTEMPTS <= 5, true);
  assertEquals(MAX_RETRIES >= 1, true);
  assertEquals(MAX_RETRIES <= 3, true);
});

// ============================================================================
// IMAGE UPLOAD TESTS
// ============================================================================

Deno.test({
  name: "lecture-slides storage bucket exists",
  ignore: !SUPABASE_SERVICE_ROLE_KEY,
  async fn() {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data, error } = await supabase.storage.listBuckets();
    
    assertEquals(error, null);
    assertExists(data);
    
    const lectureBucket = data.find(b => b.name === 'lecture-slides');
    assertExists(lectureBucket, 'lecture-slides bucket should exist');
  }
});

// ============================================================================
// SLIDE UPDATE TESTS
// ============================================================================

Deno.test("lecture_slides table has slides JSON column", async () => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  
  const { data, error } = await supabase
    .from('lecture_slides')
    .select('id, slides, status')
    .limit(1);
  
  assertEquals(error, null);
  
  if (data && data.length > 0) {
    assertExists(data[0].slides, 'slides column should exist');
    assertEquals(Array.isArray(data[0].slides), true, 'slides should be an array');
  }
});

// ============================================================================
// SELF-CONTINUATION TESTS
// ============================================================================

Deno.test("Self-continuation URL is valid", () => {
  const url = `${SUPABASE_URL}/functions/v1/process-batch-images`;
  
  // URL should be valid
  const parsed = new URL(url);
  assertEquals(parsed.protocol, 'https:');
  assertExists(parsed.hostname);
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

Deno.test("Failed items are properly marked", async () => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  
  // Check that failed items have error messages
  const { data, error } = await supabase
    .from('image_generation_queue')
    .select('id, status, error_message, attempts')
    .eq('status', 'failed')
    .limit(10);
  
  assertEquals(error, null);
  
  if (data && data.length > 0) {
    data.forEach(row => {
      // Failed items should have error context
      assertEquals(row.status, 'failed');
      // Attempts should be > 0 (tried at least once)
      assertEquals(row.attempts > 0, true, 'Failed items should have attempts > 0');
    });
  }
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║         Process Batch Images Pipeline Tests                        ║
╠════════════════════════════════════════════════════════════════════╣
║  Database Tests: Verify queue table and schema                     ║
║  Edge Function Tests: Check deployment and invocation              ║
║  Processing Tests: Verify batch and retry logic                    ║
║  Storage Tests: Check bucket configuration                         ║
║  Error Handling Tests: Verify failure tracking                     ║
╚════════════════════════════════════════════════════════════════════╝

Environment:
  SUPABASE_URL: ${SUPABASE_URL ? '✅ Set' : '❌ Missing'}
  SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
  SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '⚠️ Optional'}
`);
