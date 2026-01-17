/**
 * AI-Driven Fallback Narration Generator
 * Generates natural lecture narration when speaker_notes are missing or insufficient
 */

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface SlideForNarration {
  order?: number;
  type?: string;
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
      connection_to_concept?: string;
    };
    misconception?: {
      wrong_belief?: string;
      why_wrong?: string;
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

export interface NarrationContext {
  slideIndex: number;
  totalSlides: number;
  unitTitle: string;
  domain: string;
}

/**
 * Check if speaker notes need AI-generated narration
 */
export function needsNarration(speakerNotes: string | undefined): boolean {
  if (!speakerNotes) return true;
  const trimmed = speakerNotes.trim();
  // Need narration if empty, too short, or just placeholder text
  return trimmed.length < 50 || 
         trimmed === 'No notes' || 
         trimmed.toLowerCase().includes('[placeholder]');
}

/**
 * Generate natural lecture narration for a slide using AI
 */
export async function generateNarration(
  slide: SlideForNarration,
  context: NarrationContext,
  apiKey: string
): Promise<string> {
  const isFirstSlide = context.slideIndex === 0;
  const isLastSlide = context.slideIndex === context.totalSlides - 1;
  
  // Build content summary for AI
  const contentParts: string[] = [];
  const content = slide.content;
  
  if (content?.main_text) {
    contentParts.push(`Main text: "${content.main_text}"`);
  }
  
  if (content?.key_points?.length) {
    const points = content.key_points.map((p, i) => {
      const text = typeof p === 'string' ? p : p.text;
      return `\n  ${i + 1}. ${text}`;
    });
    contentParts.push(`Key points: ${points.join('')}`);
  }
  
  if (content?.definition) {
    const def = content.definition;
    const defText = def.formal_definition || def.simple_explanation || '';
    contentParts.push(`Definition of "${def.term || 'term'}": ${defText}`);
  }
  
  if (content?.example) {
    const ex = content.example;
    contentParts.push(`Example: ${ex.scenario || ''}. ${ex.walkthrough || ''}`);
  }
  
  if (content?.misconception) {
    const mis = content.misconception;
    contentParts.push(`Misconception addressed: Wrong belief "${mis.wrong_belief || ''}" - Why wrong: ${mis.why_wrong || ''} - Correct: ${mis.correct_understanding || ''}`);
  }
  
  if (content?.steps?.length) {
    const steps = content.steps.map(s => `\n  ${s.step}. ${s.title}: ${s.explanation}`);
    contentParts.push(`Steps: ${steps.join('')}`);
  }

  const prompt = `Generate natural, conversational lecture narration for this slide.

CONTEXT:
- Topic: ${context.unitTitle}
- Domain: ${context.domain}
- Slide ${context.slideIndex + 1} of ${context.totalSlides}
- Slide type: ${slide.type || 'concept'}
- Slide title: "${slide.title || 'Untitled'}"

SLIDE CONTENT:
${contentParts.join('\n') || 'No structured content available.'}

${slide.speaker_notes ? `EXISTING NOTES (expand on these): "${slide.speaker_notes}"` : ''}

INSTRUCTIONS:
1. Write 150-250 words of natural professor narration
2. Sound conversational, not robotic - use contractions, rhetorical questions, asides
3. Don't just read the bullet points verbatim - elaborate and explain
4. Add connective tissue ("Now, let's look at...", "This is important because...", "Think of it this way...")
5. Match the slide type tone:
   - definition slides: authoritative but clear
   - example slides: storytelling, relatable
   - misconception slides: empathetic but corrective
   - summary slides: reinforcing, encouraging
${isFirstSlide ? '6. This is the FIRST slide - start with a warm welcome and preview' : ''}
${isLastSlide ? '6. This is the LAST slide - conclude with a summary and encourage next steps' : ''}

Return ONLY the narration text, no explanations or metadata.`;

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
          parts: [{ text: 'You are an expert university professor who gives engaging, clear lectures. You speak naturally and conversationally while maintaining academic authority.' }],
        },
        generationConfig: {
          maxOutputTokens: 800,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const narration = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!narration || narration.length < 50) {
      throw new Error('Generated narration too short');
    }

    return narration;
  } catch (error) {
    console.error('AI narration generation failed:', error);
    throw error;
  }
}

/**
 * Batch generate narration for multiple slides
 */
export async function batchGenerateNarration(
  slides: SlideForNarration[],
  unitTitle: string,
  domain: string,
  apiKey: string
): Promise<Map<number, string>> {
  const narrations = new Map<number, string>();
  
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    
    if (!needsNarration(slide.speaker_notes)) {
      continue;
    }

    try {
      const narration = await generateNarration(
        slide,
        {
          slideIndex: i,
          totalSlides: slides.length,
          unitTitle,
          domain,
        },
        apiKey
      );
      
      const order = slide.order ?? i;
      narrations.set(order, narration);
      
      // Small delay to avoid rate limiting
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Failed to generate narration for slide ${i + 1}:`, error);
    }
  }
  
  return narrations;
}