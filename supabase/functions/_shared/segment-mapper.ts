/**
 * AI-Driven Content-Audio Segment Mapper
 * Maps speaker notes to slide content blocks for synchronized highlighting
 */

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export interface ContentBlock {
  id: string;
  type: 'title' | 'main_text' | 'key_point' | 'definition' | 'example' | 'misconception' | 'step';
  content: string;
  index?: number; // For key_points and steps
}

export interface AudioSegment {
  target_block: string; // ContentBlock.id
  start_percent: number;
  end_percent: number;
  narration_excerpt: string;
}

export interface SlideForMapping {
  title: string;
  content: {
    main_text: string;
    key_points?: string[];
    definition?: {
      term: string;
      formal_definition?: string;
      simple_explanation?: string;
    };
    example?: {
      scenario: string;
      walkthrough?: string;
    };
    misconception?: {
      wrong_belief: string;
      correct_understanding: string;
    };
    steps?: {
      step: number;
      title: string;
      explanation: string;
    }[];
  };
  speaker_notes: string;
}

/**
 * Extract identifiable content blocks from a slide
 */
export function extractContentBlocks(slide: SlideForMapping): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Title is always first
  blocks.push({
    id: 'title',
    type: 'title',
    content: slide.title,
  });

  // Main text
  if (slide.content.main_text) {
    blocks.push({
      id: 'main_text',
      type: 'main_text',
      content: slide.content.main_text,
    });
  }

  // Key points
  if (slide.content.key_points?.length) {
    slide.content.key_points.forEach((point, i) => {
      blocks.push({
        id: `key_point_${i}`,
        type: 'key_point',
        content: point,
        index: i,
      });
    });
  }

  // Definition
  if (slide.content.definition) {
    const def = slide.content.definition;
    blocks.push({
      id: 'definition',
      type: 'definition',
      content: `${def.term}: ${def.formal_definition || def.simple_explanation}`,
    });
  }

  // Example
  if (slide.content.example) {
    blocks.push({
      id: 'example',
      type: 'example',
      content: slide.content.example.scenario,
    });
  }

  // Misconception
  if (slide.content.misconception) {
    blocks.push({
      id: 'misconception',
      type: 'misconception',
      content: slide.content.misconception.wrong_belief,
    });
  }

  // Steps
  if (slide.content.steps?.length) {
    slide.content.steps.forEach((step) => {
      blocks.push({
        id: `step_${step.step}`,
        type: 'step',
        content: step.title,
        index: step.step,
      });
    });
  }

  return blocks;
}

/**
 * Map speaker notes segments to content blocks using AI
 */
export async function mapAudioSegments(
  slide: SlideForMapping,
  audioDurationSeconds: number,
  apiKey: string
): Promise<AudioSegment[]> {
  const blocks = extractContentBlocks(slide);
  
  if (blocks.length <= 1) {
    // Only title, return single segment
    return [{
      target_block: 'title',
      start_percent: 0,
      end_percent: 100,
      narration_excerpt: slide.speaker_notes.slice(0, 50),
    }];
  }

  const blockDescriptions = blocks.map(b => 
    `- ${b.id}: "${b.content.slice(0, 100)}${b.content.length > 100 ? '...' : ''}"`
  ).join('\n');

  const prompt = `Map this speaker narration to slide content blocks for synchronized highlighting during playback.

SLIDE CONTENT BLOCKS:
${blockDescriptions}

SPEAKER NOTES (${slide.speaker_notes.length} characters, ~${audioDurationSeconds} seconds of audio):
"""
${slide.speaker_notes}
"""

TASK:
Analyze the narration and identify which parts discuss which content blocks.
Return a JSON array where each segment maps a portion of the narration to a content block.

RULES:
1. Segments must cover 0-100% without gaps or overlaps
2. Each segment maps to exactly one target_block id from the list above
3. A block can have multiple segments if the narration returns to it
4. Order segments by start_percent ascending
5. Estimate timing based on word density and natural speech patterns
6. Include a short excerpt (first few words) of the narration for that segment

IMPORTANT SEMANTIC MAPPING:
- "As you can see" or "Look at" → usually references visual/example
- "The key point here" → maps to relevant key_point_N
- "Let me define" or "What is" → maps to definition
- "For example" or "Consider this" → maps to example
- "A common mistake" or "Many believe" → maps to misconception
- "First/Second/Then" → maps to step_N
- Opening and closing usually reference title or main_text

Return ONLY a valid JSON array:
[
  {
    "target_block": "main_text",
    "start_percent": 0,
    "end_percent": 25,
    "narration_excerpt": "Let's begin by understanding..."
  },
  ...
]`;

  try {
    const response = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at analyzing lecture narration and mapping spoken content to slide elements. You understand how professors naturally reference visual content while speaking. Return only valid JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2, // Low temperature for consistent structure
      }),
    });

    if (!response.ok) {
      console.error('[Segment Mapper] API error:', response.status);
      return createProportionalMapping(blocks, slide.speaker_notes);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return createProportionalMapping(blocks, slide.speaker_notes);
    }

    // Extract JSON from possible markdown wrapper
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      content = jsonMatch[1].trim();
    }

    const segments = JSON.parse(content) as AudioSegment[];
    
    // Validate segments
    if (!Array.isArray(segments) || segments.length === 0) {
      return createProportionalMapping(blocks, slide.speaker_notes);
    }

    // Validate all target_blocks exist
    const validBlockIds = new Set(blocks.map(b => b.id));
    const validSegments = segments.filter(s => validBlockIds.has(s.target_block));

    if (validSegments.length === 0) {
      return createProportionalMapping(blocks, slide.speaker_notes);
    }

    console.log(`[Segment Mapper] Mapped ${validSegments.length} segments to ${blocks.length} blocks`);
    return validSegments;

  } catch (error) {
    console.error('[Segment Mapper] Error:', error);
    return createProportionalMapping(blocks, slide.speaker_notes);
  }
}

/**
 * Fallback: Create proportional mapping based on content length
 */
function createProportionalMapping(
  blocks: ContentBlock[],
  speakerNotes: string
): AudioSegment[] {
  if (blocks.length === 0) return [];

  const totalContentLength = blocks.reduce((sum, b) => sum + b.content.length, 0);
  const segments: AudioSegment[] = [];
  let currentPercent = 0;

  blocks.forEach((block, i) => {
    const proportion = block.content.length / totalContentLength;
    const endPercent = i === blocks.length - 1 ? 100 : Math.round(currentPercent + proportion * 100);

    segments.push({
      target_block: block.id,
      start_percent: Math.round(currentPercent),
      end_percent: endPercent,
      narration_excerpt: `Segment ${i + 1}`,
    });

    currentPercent = endPercent;
  });

  return segments;
}

/**
 * Batch process segment mapping for multiple slides
 */
export async function batchMapSegments(
  slides: Array<SlideForMapping & { order: number; audio_duration_seconds?: number }>,
  apiKey: string
): Promise<Map<number, AudioSegment[]>> {
  const mappings = new Map<number, AudioSegment[]>();

  for (const slide of slides) {
    if (!slide.speaker_notes || !slide.audio_duration_seconds) {
      continue;
    }

    try {
      const segments = await mapAudioSegments(
        slide,
        slide.audio_duration_seconds,
        apiKey
      );
      mappings.set(slide.order, segments);

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Segment Mapper] Failed for slide ${slide.order}:`, error);
    }
  }

  return mappings;
}
