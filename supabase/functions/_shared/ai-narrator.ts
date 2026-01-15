/**
 * AI-Driven Fallback Narration Generator
 * Generates natural lecture narration when speaker_notes are missing or insufficient
 */

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export interface SlideForNarration {
  order: number;
  type: string;
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
      connection_to_concept?: string;
    };
    misconception?: {
      wrong_belief: string;
      why_wrong: string;
      correct_understanding: string;
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
  
  if (slide.content.main_text) {
    contentParts.push(`Main text: "${slide.content.main_text}"`);
  }
  
  if (slide.content.key_points?.length) {
    contentParts.push(`Key points: ${slide.content.key_points.map((p, i) => `\n  ${i + 1}. ${p}`).join('')}`);
  }
  
  if (slide.content.definition) {
    contentParts.push(`Definition of "${slide.content.definition.term}": ${slide.content.definition.formal_definition || slide.content.definition.simple_explanation}`);
  }
  
  if (slide.content.example) {
    contentParts.push(`Example: ${slide.content.example.scenario}. ${slide.content.example.walkthrough || ''}`);
  }
  
  if (slide.content.misconception) {
    contentParts.push(`Misconception addressed: Wrong belief "${slide.content.misconception.wrong_belief}" - Why wrong: ${slide.content.misconception.why_wrong} - Correct: ${slide.content.misconception.correct_understanding}`);
  }
  
  if (slide.content.steps?.length) {
    contentParts.push(`Steps: ${slide.content.steps.map(s => `\n  ${s.step}. ${s.title}: ${s.explanation}`).join('')}`);
  }

  const prompt = `Generate natural, conversational lecture narration for this slide.

CONTEXT:
- Topic: ${context.unitTitle}
- Domain: ${context.domain}
- Slide ${context.slideIndex + 1} of ${context.totalSlides}
- Slide type: ${slide.type}
- Slide title: "${slide.title}"
${isFirstSlide ? '- This is the OPENING slide - start with a welcoming, energetic tone' : ''}
${isLastSlide ? '- This is the FINAL slide - use a conclusive, summarizing tone' : ''}

SLIDE CONTENT:
${contentParts.join('\n')}

REQUIREMENTS:
1. Write 150-250 words of natural professor narration
2. Sound conversational, not robotic - like an experienced teacher speaking
3. DON'T just read the bullet points verbatim - add insight, context, and explanations
4. Add connective phrases ("Now, let's consider...", "This is crucial because...", "You might be wondering...")
5. Match the slide type tone:
   - title/hook: enthusiastic, engaging
   - definition: authoritative, precise but accessible
   - example: storytelling, relatable
   - misconception: corrective but empathetic
   - synthesis/summary: reflective, connecting ideas
   - process: methodical, step-by-step
6. If there's visual content, reference it naturally ("As you can see in the diagram...")
7. ${isFirstSlide ? 'Welcome students and frame why this topic matters for their learning' : ''}
8. ${isLastSlide ? 'Summarize key takeaways and provide a sense of closure' : ''}

Return ONLY the narration text, no explanations or formatting.`;

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
          content: 'You are an experienced university professor creating natural, engaging lecture narration. Your speech is warm, authoritative, and educational. You explain concepts clearly while maintaining an engaging conversational tone.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI Narrator] Error:', response.status, errorText);
    throw new Error(`AI narration failed: ${response.status}`);
  }

  const data = await response.json();
  const narration = data.choices?.[0]?.message?.content?.trim();

  if (!narration) {
    throw new Error('No narration content returned');
  }

  console.log(`[AI Narrator] Generated ${narration.length} chars for slide ${context.slideIndex + 1}`);
  return narration;
}

/**
 * Batch generate narration for multiple slides that need it
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
      
      narrations.set(slide.order, narration);
      
      // Small delay to avoid rate limiting
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`[AI Narrator] Failed for slide ${i + 1}:`, error);
      // Continue with other slides even if one fails
    }
  }

  return narrations;
}
