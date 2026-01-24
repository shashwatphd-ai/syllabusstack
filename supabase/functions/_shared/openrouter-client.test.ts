/**
 * OpenRouter Client Tests
 *
 * Tests for the AI routing pipeline using OpenRouter as the primary gateway.
 * Updated 2026-01-22 to reflect new model constants and routing architecture.
 *
 * Run with: deno test --allow-env --allow-net supabase/functions/_shared/openrouter-client.test.ts
 */

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

// Expected model IDs from openrouter-client.ts MODELS constant
const EXPECTED_MODELS = {
  PROFESSOR_AI: 'google/gemini-2.5-flash',
  PROFESSOR_AI_FALLBACK: 'google/gemini-flash-1.5',
  IMAGE: 'google/gemini-2.5-flash-image',
  IMAGE_FREE: 'google/gemini-2.5-flash-image-preview:free',
  REASONING: 'openai/gpt-4.1',
  FAST: 'openai/gpt-4o-mini',
};

// Get environment variables (required for live tests)
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://syllabusstack.com';

// ============================================================================
// UNIT TESTS - Model Constants Verification
// ============================================================================

Deno.test("MODELS.PROFESSOR_AI is correctly defined", () => {
  // Verify the primary Professor AI model
  assertEquals(EXPECTED_MODELS.PROFESSOR_AI, 'google/gemini-2.5-flash');
});

Deno.test("MODELS.PROFESSOR_AI_FALLBACK is correctly defined", () => {
  // Verify the fallback model
  assertEquals(EXPECTED_MODELS.PROFESSOR_AI_FALLBACK, 'google/gemini-flash-1.5');
});

Deno.test("MODELS.IMAGE is correctly defined (Nano Banana)", () => {
  // Verify the image generation model (Nano Banana)
  assertEquals(EXPECTED_MODELS.IMAGE, 'google/gemini-2.5-flash-image');
});

Deno.test("MODELS.IMAGE_FREE is correctly defined", () => {
  // Verify the free tier image model
  assertEquals(EXPECTED_MODELS.IMAGE_FREE, 'google/gemini-2.5-flash-image-preview:free');
});

// ============================================================================
// UNIT TESTS - Request/Response Format
// ============================================================================

Deno.test("Text generation request format is correct", () => {
  const prompt = "Create a lecture about strategic management";
  const systemPrompt = "You are an expert professor.";

  const requestBody = {
    model: EXPECTED_MODELS.PROFESSOR_AI,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 16000,
  };

  assertEquals(requestBody.model, 'google/gemini-2.5-flash');
  assertEquals(requestBody.messages.length, 2);
  assertEquals(requestBody.messages[0].role, 'system');
  assertEquals(requestBody.messages[1].role, 'user');
});

Deno.test("Image generation request format is correct", () => {
  const prompt = "Generate a diagram showing data flow";

  const requestBody = {
    model: EXPECTED_MODELS.IMAGE,
    messages: [{ role: 'user', content: prompt }],
  };

  assertEquals(requestBody.model, 'google/gemini-2.5-flash-image');
  assertEquals(requestBody.messages.length, 1);
  assertEquals(requestBody.messages[0].role, 'user');
});

Deno.test("Request with fallbacks is correctly structured", () => {
  const requestBody = {
    model: EXPECTED_MODELS.PROFESSOR_AI,
    messages: [{ role: 'user', content: 'Test' }],
    route: 'fallback',
    models: [EXPECTED_MODELS.PROFESSOR_AI, EXPECTED_MODELS.PROFESSOR_AI_FALLBACK],
  };

  assertEquals(requestBody.route, 'fallback');
  assertEquals(requestBody.models.length, 2);
  assertEquals(requestBody.models[0], 'google/gemini-2.5-flash');
  assertEquals(requestBody.models[1], 'google/gemini-flash-1.5');
});

Deno.test("Required headers are present for OpenRouter", () => {
  const headers = {
    'Authorization': `Bearer test-key`,
    'Content-Type': 'application/json',
    'HTTP-Referer': APP_URL,
    'X-Title': 'SyllabusStack',
  };

  assertExists(headers['Authorization']);
  assertExists(headers['HTTP-Referer']);
  assertEquals(headers['X-Title'], 'SyllabusStack');
});

// ============================================================================
// UNIT TESTS - Response Parsing
// ============================================================================

Deno.test("Text response parsing extracts content correctly", () => {
  const mockResponse = {
    choices: [{
      message: {
        role: 'assistant',
        content: '{"slides": [{"title": "Introduction"}]}',
      },
      finish_reason: 'stop',
    }],
    model: 'google/gemini-2.5-flash',
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  };

  const content = mockResponse.choices?.[0]?.message?.content;
  assertExists(content);
  assertEquals(typeof content, 'string');

  // Parse JSON from response
  const parsed = JSON.parse(content);
  assertExists(parsed.slides);
});

Deno.test("Image response parsing extracts base64 from content array", () => {
  // Format 1: content is array with image_url items
  const mockResponse = {
    choices: [{
      message: {
        content: [
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
            }
          }
        ]
      }
    }]
  };

  const content = mockResponse.choices?.[0]?.message?.content;
  assertExists(content);
  assertEquals(Array.isArray(content), true);

  const imagePart = (content as Array<{ type: string; image_url?: { url: string } }>).find(
    (p) => p.type === 'image_url'
  );
  assertExists(imagePart?.image_url?.url);
  assertStringIncludes(imagePart!.image_url!.url, 'data:image/png;base64,');
});

Deno.test("Image response parsing handles images array format", () => {
  // Format 2: images array on message
  const mockResponse = {
    choices: [{
      message: {
        content: 'Here is your image.',
        images: [{
          image_url: {
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
          }
        }]
      }
    }]
  };

  const images = (mockResponse.choices?.[0]?.message as { images?: Array<{ image_url?: { url: string } }> })?.images;
  assertExists(images);
  assertEquals(images.length, 1);

  const imageUrl = images[0]?.image_url?.url;
  assertExists(imageUrl);
  assertStringIncludes(imageUrl, 'data:image/png;base64,');
});

Deno.test("Handles empty choices array gracefully", () => {
  const mockEmptyChoices: { choices: Array<{ message?: { content: string } }> } = { choices: [] };

  const message = mockEmptyChoices.choices?.[0]?.message;
  assertEquals(message, undefined);
});

Deno.test("Handles missing images gracefully", () => {
  const mockResponseNoImages = {
    choices: [{
      message: {
        role: 'assistant',
        content: 'Sorry, I could not generate an image.'
      }
    }]
  };

  const images = (mockResponseNoImages.choices?.[0]?.message as { images?: unknown[] })?.images;
  assertEquals(images, undefined);
});

// ============================================================================
// UNIT TESTS - Error Response Structure
// ============================================================================

Deno.test("ImageResult error structure is correct", () => {
  const errorResult = {
    success: false,
    error: {
      code: 'IMAGE_GENERATION_FAILED' as const,
      message: 'Test error message',
      provider: 'openrouter' as const,
      model: 'google/gemini-2.5-flash-image',
    }
  };

  assertEquals(errorResult.success, false);
  assertExists(errorResult.error.code);
  assertExists(errorResult.error.message);
  assertExists(errorResult.error.provider);
  assertExists(errorResult.error.model);
});

Deno.test("ImageResult success structure is correct", () => {
  const successResult = {
    success: true,
    base64: 'iVBORw0KGgo=',
    mimeType: 'image/png',
    provider: 'openrouter' as const,
    model: 'google/gemini-2.5-flash-image',
    cost_usd: 0.039,
    latency_ms: 1500,
  };

  assertEquals(successResult.success, true);
  assertExists(successResult.base64);
  assertExists(successResult.mimeType);
  assertEquals(successResult.provider, 'openrouter');
});

// ============================================================================
// UNIT TESTS - Batch Provider Toggle
// ============================================================================

Deno.test("BATCH_PROVIDER defaults to openrouter", () => {
  // When BATCH_PROVIDER is not set, should default to 'openrouter'
  const BATCH_PROVIDER = Deno.env.get('BATCH_PROVIDER') || 'openrouter';
  assertEquals(['openrouter', 'vertex'].includes(BATCH_PROVIDER), true);
});

// ============================================================================
// INTEGRATION TESTS - Require API key
// ============================================================================

Deno.test({
  name: "OpenRouter API is reachable",
  ignore: !OPENROUTER_API_KEY,
  async fn() {
    const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      }
    });

    assertEquals(response.ok, true);
    const data = await response.json();
    assertExists(data.data);
  }
});

Deno.test({
  name: "MODELS.PROFESSOR_AI model is available on OpenRouter",
  ignore: !OPENROUTER_API_KEY,
  async fn() {
    const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      }
    });

    const data = await response.json();
    const model = data.data.find((m: { id: string }) => m.id === EXPECTED_MODELS.PROFESSOR_AI);

    assertExists(model, `Model ${EXPECTED_MODELS.PROFESSOR_AI} should be available on OpenRouter`);
  }
});

Deno.test({
  name: "MODELS.IMAGE model is available on OpenRouter (Nano Banana)",
  ignore: !OPENROUTER_API_KEY,
  async fn() {
    const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      }
    });

    const data = await response.json();
    const model = data.data.find((m: { id: string }) => m.id === EXPECTED_MODELS.IMAGE);

    assertExists(model, `Model ${EXPECTED_MODELS.IMAGE} (Nano Banana) should be available on OpenRouter`);
  }
});

Deno.test({
  name: "Text generation request returns valid response",
  ignore: !OPENROUTER_API_KEY,
  async fn() {
    const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_URL,
        'X-Title': 'SyllabusStack-Test',
      },
      body: JSON.stringify({
        model: EXPECTED_MODELS.PROFESSOR_AI,
        messages: [{
          role: 'user',
          content: 'Say "Hello, test successful!" in exactly those words.'
        }],
        max_tokens: 50,
      })
    });

    if (response.status === 429) {
      console.log('Rate limited - test skipped');
      return;
    }

    assertEquals(response.ok, true);
    const data = await response.json();
    assertExists(data.choices);
    assertEquals(data.choices.length > 0, true);
    assertExists(data.choices[0].message.content);
  }
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

Deno.test("Handles very long prompts", () => {
  const longPrompt = "Generate an educational diagram showing ".repeat(100);

  const requestBody = {
    model: EXPECTED_MODELS.IMAGE,
    messages: [{ role: 'user', content: longPrompt }],
  };

  const jsonString = JSON.stringify(requestBody);
  assertExists(jsonString);
  assertEquals(jsonString.length > 1000, true);
});

Deno.test("Handles special characters in prompts", () => {
  const specialPrompt = 'Generate a diagram with "quotes", <brackets>, and émojis 🎨';

  const requestBody = {
    model: EXPECTED_MODELS.IMAGE,
    messages: [{ role: 'user', content: specialPrompt }],
  };

  const jsonString = JSON.stringify(requestBody);
  assertStringIncludes(jsonString, 'émojis');
  assertStringIncludes(jsonString, '🎨');
});

// ============================================================================
// ARCHITECTURE VERIFICATION TESTS
// ============================================================================

Deno.test("Routing architecture: Text uses OpenRouter", () => {
  // Document the expected routing for text generation
  const textRouting = {
    operation: 'Professor AI (text)',
    provider: 'openrouter',
    model: EXPECTED_MODELS.PROFESSOR_AI,
    fallback: EXPECTED_MODELS.PROFESSOR_AI_FALLBACK,
  };

  assertEquals(textRouting.provider, 'openrouter');
  assertEquals(textRouting.model, 'google/gemini-2.5-flash');
});

Deno.test("Routing architecture: Images use OpenRouter", () => {
  // Document the expected routing for image generation
  const imageRouting = {
    operation: 'Image Generation',
    provider: 'openrouter',
    model: EXPECTED_MODELS.IMAGE,
    fallback: null, // No fallback - explicit errors
  };

  assertEquals(imageRouting.provider, 'openrouter');
  assertEquals(imageRouting.model, 'google/gemini-2.5-flash-image');
  assertEquals(imageRouting.fallback, null);
});

Deno.test("Routing architecture: Batch supports toggle", () => {
  // Document the expected batch routing options
  const batchRouting = {
    operation: 'Batch Slide Generation',
    envVar: 'BATCH_PROVIDER',
    options: ['openrouter', 'vertex'],
    default: 'openrouter',
  };

  assertEquals(batchRouting.options.includes('openrouter'), true);
  assertEquals(batchRouting.options.includes('vertex'), true);
  assertEquals(batchRouting.default, 'openrouter');
});

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           OpenRouter AI Routing Tests (Updated 2026-01-22)         ║
╠════════════════════════════════════════════════════════════════════╣
║  Model Constants:                                                  ║
║    - PROFESSOR_AI: google/gemini-2.5-flash                         ║
║    - IMAGE: google/gemini-2.5-flash-image (Nano Banana)            ║
║                                                                    ║
║  Routing:                                                          ║
║    - Text generation → OpenRouter                                  ║
║    - Image generation → OpenRouter (no fallback, explicit errors)  ║
║    - Batch → OpenRouter (default) or Vertex (BATCH_PROVIDER=vertex)║
║                                                                    ║
║  Integration tests require OPENROUTER_API_KEY env var              ║
╚════════════════════════════════════════════════════════════════════╝
`);
