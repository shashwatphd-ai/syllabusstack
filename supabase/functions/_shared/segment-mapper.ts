/**
 * AI-Driven Content-Audio Segment Mapper
 * Maps speaker notes to slide content blocks for synchronized highlighting
 */

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

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
  narration_excerpt?: string;
}

export interface SlideForMapping {
  title?: string;
  content?: {
    main_text?: string;
    key_points?: (string | { text: string })[];
    definition?: {
      term?: string;
      formal_definition?: string;
      simple_explanation?: string;
    };
    example?: {
      scenario?: string;
      walkthrough?: string;
    };
    misconception?: {
      wrong_belief?: string;
      correct_understanding?: string;
    };
    steps?: {
      step: number;
      title: string;
      explanation: string;
    }[];
  };
  speaker_notes?: string;
}

/**
 * Extract identifiable content blocks from a slide
 */
export function extractContentBlocks(slide: SlideForMapping): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const content = slide.content;

  // Title is always first
  blocks.push({
    id: 'title',
    type: 'title',
    content: slide.title || 'Untitled',
  });

  // Main text
  if (content?.main_text) {
    blocks.push({
      id: 'main_text',
      type: 'main_text',
      content: content.main_text,
    });
  }

  // Key points
  if (content?.key_points?.length) {
    content.key_points.forEach((point, i) => {
      const text = typeof point === 'string' ? point : point.text;
      blocks.push({
        id: `key_point_${i}`,
        type: 'key_point',
        content: text,
        index: i,
      });
    });
  }

  // Definition
  if (content?.definition) {
    const def = content.definition;
    const defText = def.formal_definition || def.simple_explanation || '';
    blocks.push({
      id: 'definition',
      type: 'definition',
      content: `${def.term || 'Term'}: ${defText}`,
    });
  }

  // Example
  if (content?.example?.scenario) {
    blocks.push({
      id: 'example',
      type: 'example',
      content: content.example.scenario,
    });
  }

  // Misconception
  if (content?.misconception?.wrong_belief) {
    blocks.push({
      id: 'misconception',
      type: 'misconception',
      content: content.misconception.wrong_belief,
    });
  }

  // Steps
  if (content?.steps?.length) {
    content.steps.forEach((step) => {
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
 * Create proportional mapping based on block count (fallback)
 */
function createProportionalMapping(blocks: ContentBlock[], speakerNotes: string): AudioSegment[] {
  if (blocks.length === 0) {
    return [{ target_block: 'main_text', start_percent: 0, end_percent: 100 }];
  }

  const segmentSize = 100 / blocks.length;
  return blocks.map((block, i) => ({
    target_block: block.id,
    start_percent: Math.round(i * segmentSize),
    end_percent: Math.round((i + 1) * segmentSize),
    narration_excerpt: speakerNotes.slice(0, 50),
  }));
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
  const speakerNotes = slide.speaker_notes || '';
  
  if (!speakerNotes || speakerNotes.length < 50 || blocks.length <= 1) {
    return createProportionalMapping(blocks, speakerNotes);
  }

  const blocksSummary = blocks.map(b => `- ${b.id}: "${b.content.slice(0, 80)}..."`).join('\n');

  const prompt = `Map this speaker narration to slide content blocks for synchronized highlighting.

SLIDE CONTENT BLOCKS:
${blocksSummary}

SPEAKER NOTES (${speakerNotes.length} characters, ~${audioDurationSeconds} seconds of audio):
"${speakerNotes}"

TASK:
Analyze the speaker notes and determine which portions correspond to which content blocks.
Return a JSON array mapping narration segments to content blocks.

RULES:
1. Each segment must have: target_block (block id), start_percent (0-100), end_percent (0-100), narration_excerpt (first few words)
2. Segments must be contiguous (end of one = start of next)
3. Segments must cover 0-100% range completely
4. Match semantic meaning, not just word order
5. A block can have multiple segments if the narration returns to it
6. Valid target_block values: ${blocks.map(b => b.id).join(', ')}

Return ONLY the JSON array, no explanation:
[{"target_block": "...", "start_percent": 0, "end_percent": X, "narration_excerpt": "..."}, ...]`;

  try {
    const model = 'gemini-2.5-flash';
    const url = `${GOOGLE_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        systemInstruction: {
          parts: [{ text: 'You are an expert at analyzing educational content structure. Output valid JSON only.' }],
        },
        generationConfig: {
          maxOutputTokens: 1000,
        },
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      return createProportionalMapping(blocks, speakerNotes);
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      content = jsonMatch[1].trim();
    }

    // Try to parse JSON
    const segments = JSON.parse(content) as AudioSegment[];

    // Validate segments
    if (!Array.isArray(segments) || segments.length === 0) {
      console.warn('Invalid segment array, using proportional fallback');
      return createProportionalMapping(blocks, speakerNotes);
    }

    // Validate each segment has required fields
    const validBlockIds = new Set(blocks.map(b => b.id));
    const validSegments = segments.filter(s => 
      typeof s.target_block === 'string' &&
      validBlockIds.has(s.target_block) &&
      typeof s.start_percent === 'number' &&
      typeof s.end_percent === 'number' &&
      s.start_percent >= 0 &&
      s.end_percent <= 100 &&
      s.end_percent > s.start_percent
    );

    if (validSegments.length === 0) {
      console.warn('No valid segments, using proportional fallback');
      return createProportionalMapping(blocks, speakerNotes);
    }

    return validSegments;
  } catch (error) {
    console.error('Segment mapping failed:', error);
    return createProportionalMapping(blocks, speakerNotes);
  }
}

/**
 * Batch map segments for multiple slides
 */
export async function batchMapSegments(
  slides: Array<SlideForMapping & { order: number; audio_duration_seconds?: number }>,
  apiKey: string
): Promise<Map<number, AudioSegment[]>> {
  const results = new Map<number, AudioSegment[]>();
  
  for (const slide of slides) {
    try {
      const segments = await mapAudioSegments(
        slide,
        slide.audio_duration_seconds || 60,
        apiKey
      );
      results.set(slide.order, segments);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to map segments for slide ${slide.order}:`, error);
    }
  }
  
  return results;
}