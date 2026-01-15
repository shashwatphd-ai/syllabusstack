/**
 * AI-Driven SSML Transformer
 * Converts plain speaker notes into expressive SSML for natural text-to-speech
 */

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export interface SSMLContext {
  slideType: string;
  slideIndex: number;
  totalSlides: number;
  hasKeyPoints?: boolean;
  hasDefinition?: boolean;
  hasExample?: boolean;
  hasMisconception?: boolean;
  hasSteps?: boolean;
}

/**
 * Transform speaker notes into SSML using AI
 * The AI analyzes the semantic content and adds appropriate prosody
 */
export async function transformToSSML(
  speakerNotes: string,
  context: SSMLContext,
  apiKey: string
): Promise<string> {
  const isFirst = context.slideIndex === 0;
  const isLast = context.slideIndex === context.totalSlides - 1;

  const prompt = `Transform this lecture narration into SSML for natural text-to-speech.

CONTEXT:
- Slide type: ${context.slideType}
- Position: Slide ${context.slideIndex + 1} of ${context.totalSlides}
- Is opening slide: ${isFirst}
- Is final slide: ${isLast}
- Has key points: ${context.hasKeyPoints}
- Has definition: ${context.hasDefinition}
- Has example: ${context.hasExample}
- Addresses misconception: ${context.hasMisconception}

SPEAKER NOTES:
"""
${speakerNotes}
"""

SSML TRANSFORMATION RULES:

CRITICAL: DO NOT slow down speech excessively. The base TTS already speaks at normal pace.

1. PAUSES (sparingly - only at natural breath points):
   - <break time="300ms"/> after introducing a major concept (use sparingly)
   - <break time="400ms"/> before revealing a key answer or conclusion
   - <break time="200ms"/> between sentences (only when needed for clarity)
   - DO NOT add breaks after every sentence - trust natural speech rhythm

2. EMPHASIS (use rarely - only 2-3 per slide max):
   - <emphasis level="strong">text</emphasis> ONLY for:
     * Terms being formally defined
     * Surprising/counterintuitive facts
   - <emphasis level="moderate">text</emphasis> for:
     * Key contrasts or comparisons
   - DO NOT emphasize common words or connector phrases

3. PROSODY (AVOID rate="slow" - it causes audio distortion):
   - NEVER use rate="slow" or rate="x-slow" - causes robotic distortion
   - For emphasis, prefer <emphasis> over <prosody>
   - If you must use prosody, keep rate="medium" or omit rate entirely
   - Acceptable: <prosody pitch="+5%">text</prosody> for energy
   - Acceptable: <prosody pitch="-3%">text</prosody> for gravity

4. STRUCTURE:
   - Wrap output in <speak> tags
   - Use <s> tags ONLY for very long sentences that need breaking
   - DO NOT wrap every sentence in <s> tags - let them flow naturally

5. KEEP IT SIMPLE:
   - Less is more - natural speech doesn't need excessive markup
   - Prioritize readability over complex prosody
   - The goal is natural, engaging narration - not robotic emphasis

Return ONLY the SSML markup, no explanation. The output must be valid SSML.`;

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
            content: 'You are an expert speech synthesis engineer who transforms text into expressive SSML. You understand the nuances of natural speech patterns, pauses, emphasis, and prosody. Your SSML output produces lifelike, engaging audio narration.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent SSML structure
      }),
    });

    if (!response.ok) {
      console.error('[SSML Transformer] API error:', response.status);
      // Fall back to basic SSML wrapping
      return wrapBasicSSML(speakerNotes);
    }

    const data = await response.json();
    let ssml = data.choices?.[0]?.message?.content?.trim();

    if (!ssml) {
      return wrapBasicSSML(speakerNotes);
    }

    // Clean up the SSML if AI added markdown or explanations
    ssml = extractSSML(ssml);

    // Validate basic SSML structure
    if (!ssml.startsWith('<speak>') || !ssml.endsWith('</speak>')) {
      ssml = `<speak>${ssml}</speak>`;
    }

    console.log(`[SSML Transformer] Transformed ${speakerNotes.length} chars -> ${ssml.length} chars SSML`);
    return ssml;

  } catch (error) {
    console.error('[SSML Transformer] Error:', error);
    return wrapBasicSSML(speakerNotes);
  }
}

/**
 * Extract SSML from potentially markdown-wrapped response
 */
function extractSSML(content: string): string {
  // Remove markdown code blocks if present
  const xmlMatch = content.match(/```(?:xml|ssml)?\s*([\s\S]*?)```/);
  if (xmlMatch) {
    content = xmlMatch[1].trim();
  }

  // Extract <speak> content if buried in other text
  const speakMatch = content.match(/<speak[\s\S]*<\/speak>/);
  if (speakMatch) {
    return speakMatch[0];
  }

  return content;
}

/**
 * Fallback: Wrap plain text in basic SSML
 */
function wrapBasicSSML(text: string): string {
  // Split into sentences and add basic pacing
  const sentences = text.split(/(?<=[.!?])\s+/);
  const ssmlSentences = sentences.map(s => `<s>${s.trim()}</s>`).join('\n    ');
  
  return `<speak>
  <p>
    ${ssmlSentences}
  </p>
</speak>`;
}

/**
 * Check if text is already SSML formatted
 */
export function isSSML(text: string): boolean {
  return text.trim().startsWith('<speak>') && text.trim().endsWith('</speak>');
}

/**
 * Strip SSML tags for display or word counting
 */
export function stripSSML(ssml: string): string {
  return ssml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
