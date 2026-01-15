import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPE DEFINITIONS - Professor AI v3
// ============================================================================

// Layout hint for adaptive content rendering
interface LayoutHint {
  type: 'flow' | 'comparison' | 'equation' | 'list' | 'quote' | 'callout' | 'plain';
  segments?: string[];           // For flows: ["Step 1", "Step 2", "Step 3"]
  left_right?: [string, string]; // For comparisons: ["Vision", "Mission"]
  formula?: string;              // For equations: "ROI = (Gain - Cost) / Cost"
  emphasis_words?: string[];     // Words to highlight
}

interface ProfessorSlide {
  order: number;
  type: 'title' | 'hook' | 'recap' | 'definition' | 'explanation' | 
        'example' | 'demonstration' | 'misconception' | 'practice' | 
        'synthesis' | 'preview' | 'process' | 'summary';
  title: string;
  content: {
    main_text: string;
    main_text_layout?: LayoutHint;  // AI-determined layout for main_text
    key_points?: string[];
    key_points_layout?: LayoutHint[]; // Layout hints for each key_point
    definition?: {
      term: string;
      formal_definition: string;
      simple_explanation: string;
    };
    example?: {
      scenario: string;
      walkthrough: string;
      connection_to_concept: string;
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
  visual_directive: {
    type: 'diagram' | 'screenshot' | 'comparison' | 'flowchart' | 'illustration' | 'none';
    description: string;
    elements: string[];
    style: string;
  };
  speaker_notes: string;
  estimated_seconds: number;
  pedagogy: {
    purpose: string;
    bloom_action: string;
    transition_to_next: string;
  };
}

interface TeachingUnitContext {
  id: string;
  title: string;
  what_to_teach: string;
  why_this_matters: string;
  how_to_teach: string;
  target_duration_minutes: number;
  target_video_type: string;
  prerequisites: string[];
  enables: string[];
  common_misconceptions: string[];
  required_concepts: string[];
  avoid_terms: string[];
  search_queries: string[];
  domain: string;
  syllabus_text?: string;
  learning_objective: {
    id: string;
    text: string;
    bloom_level: string;
    core_concept: string;
    action_verb: string;
  };
  module: {
    title: string;
    description: string;
    sequence_order: number;
  };
  course: {
    id: string;
    title: string;
    detected_domain: string;
    code: string;
  };
  sibling_units: {
    id: string;
    title: string;
    what_to_teach: string;
    sequence_order: number;
  }[];
  sequence_position: number;
  total_siblings: number;
}

// ============================================================================
// AI GATEWAY HELPER - Lovable AI
// ============================================================================

async function callLovableAI(
  model: string, 
  systemPrompt: string, 
  userPrompt: string,
  temperature: number = 0.7
): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  console.log(`[Professor AI] Calling ${model} with ${userPrompt.length} chars prompt`);
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Professor AI] Error from ${model}:`, response.status, errText);
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    }
    if (response.status === 402) {
      throw new Error('AI credits exhausted. Please add funds to continue.');
    }
    throw new Error(`AI call failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) throw new Error('No content in AI response');
  
  console.log(`[Professor AI] ${model} returned ${content.length} chars`);
  return content;
}

async function generateImage(
  prompt: string,
  slideTitle: string
): Promise<{ base64: string; text?: string } | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return null;

  console.log(`[Visual AI] Generating image for: ${slideTitle}`);

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{
          role: 'user',
          content: prompt
        }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      console.warn(`[Visual AI] Image generation failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const text = data.choices?.[0]?.message?.content;
    
    if (imageUrl && imageUrl.startsWith('data:image')) {
      // Extract base64 from data URL
      const base64 = imageUrl.split(',')[1];
      return { base64, text };
    }

    return null;
  } catch (error) {
    console.error(`[Visual AI] Error:`, error);
    return null;
  }
}

function parseJsonFromAI(content: string): any {
  // Extract JSON from markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  return JSON.parse(jsonStr);
}

// ============================================================================
// CONTEXT FETCHING - Comprehensive data gathering
// ============================================================================

async function fetchTeachingUnitContext(
  supabase: any,
  teachingUnitId: string
): Promise<TeachingUnitContext> {
  console.log('[Context] Fetching complete teaching unit context');

  // Fetch teaching unit with full hierarchy
  const { data: unit, error: unitError } = await supabase
    .from('teaching_units')
    .select(`
      *,
      learning_objective:learning_objectives!inner(
        id,
        text,
        bloom_level,
        core_concept,
        action_verb,
        module:modules!inner(
          id,
          title,
          description,
          sequence_order,
          instructor_course:instructor_courses!inner(
            id,
            title,
            detected_domain,
            code,
            syllabus_text
          )
        )
      )
    `)
    .eq('id', teachingUnitId)
    .single();

  if (unitError || !unit) {
    console.error('[Context] Teaching unit not found:', unitError);
    throw new Error('Teaching unit not found');
  }

  const lo = unit.learning_objective;
  const module = lo.module;
  const course = module.instructor_course;

  // Fetch sibling teaching units for sequence context
  const { data: siblingUnits } = await supabase
    .from('teaching_units')
    .select('id, title, what_to_teach, sequence_order')
    .eq('learning_objective_id', lo.id)
    .order('sequence_order');

  const siblings = siblingUnits || [];
  const currentIndex = siblings.findIndex((s: any) => s.id === teachingUnitId);

  const context: TeachingUnitContext = {
    id: unit.id,
    title: unit.title,
    what_to_teach: unit.what_to_teach || '',
    why_this_matters: unit.why_this_matters || '',
    how_to_teach: unit.how_to_teach || '',
    target_duration_minutes: unit.target_duration_minutes || 8,
    target_video_type: unit.target_video_type || 'explainer',
    prerequisites: unit.prerequisites || [],
    enables: unit.enables || [],
    common_misconceptions: unit.common_misconceptions || [],
    required_concepts: unit.required_concepts || [],
    avoid_terms: unit.avoid_terms || [],
    search_queries: unit.search_queries || [],
    domain: course.detected_domain || 'general',
    syllabus_text: course.syllabus_text,
    learning_objective: {
      id: lo.id,
      text: lo.text,
      bloom_level: lo.bloom_level || 'understand',
      core_concept: lo.core_concept || '',
      action_verb: lo.action_verb || 'explain',
    },
    module: {
      title: module.title,
      description: module.description || '',
      sequence_order: module.sequence_order,
    },
    course: {
      id: course.id,
      title: course.title,
      detected_domain: course.detected_domain || '',
      code: course.code || '',
    },
    sibling_units: siblings.map((s: any) => ({
      id: s.id,
      title: s.title,
      what_to_teach: s.what_to_teach || '',
      sequence_order: s.sequence_order,
    })),
    sequence_position: currentIndex + 1,
    total_siblings: siblings.length,
  };

  console.log('[Context] Context built:', {
    title: context.title,
    duration: context.target_duration_minutes,
    prerequisites: context.prerequisites.length,
    misconceptions: context.common_misconceptions.length,
    siblings: context.total_siblings,
    position: context.sequence_position,
  });

  return context;
}

// ============================================================================
// LECTURE BRIEF BUILDER - Comprehensive prompt assembly
// ============================================================================

function buildLectureBrief(context: TeachingUnitContext): string {
  const sequenceContext = context.sibling_units.map((unit, i) => {
    const status = unit.id === context.id 
      ? '<-- GENERATING THIS'
      : i < context.sequence_position - 1 
        ? '(COMPLETED)'
        : '(UPCOMING)';
    return `${unit.sequence_order}. ${unit.title} - ${unit.what_to_teach?.slice(0, 100) || 'No description'} ${status}`;
  }).join('\n');

  return `
=== COURSE CONTEXT ===
Course: ${context.course.title} (${context.course.code || 'No code'})
Domain: ${context.domain}
${context.syllabus_text ? `Syllabus excerpt: ${context.syllabus_text.slice(0, 500)}...` : ''}

=== MODULE CONTEXT ===
Module: ${context.module.title}
Description: ${context.module.description || 'No description provided'}

=== LEARNING OBJECTIVE ===
"${context.learning_objective.text}"
Bloom Level: ${context.learning_objective.bloom_level}
Core Concept: ${context.learning_objective.core_concept}
Action Verb: ${context.learning_objective.action_verb}

=== TEACHING UNIT SEQUENCE (Full Learning Objective) ===
${sequenceContext}

=== CURRENT TEACHING UNIT: ${context.title} ===

WHAT TO TEACH:
${context.what_to_teach}

WHY THIS MATTERS:
${context.why_this_matters}

HOW TO TEACH:
${context.how_to_teach || 'Use clear explanations with concrete examples'}

PREREQUISITES (assume student knows):
${context.prerequisites.length > 0 ? context.prerequisites.map(p => `- ${p}`).join('\n') : '- None specified'}

ENABLES (what this unlocks):
${context.enables.length > 0 ? context.enables.map(e => `- ${e}`).join('\n') : '- None specified'}

COMMON MISCONCEPTIONS (must address):
${context.common_misconceptions.length > 0 ? context.common_misconceptions.map(m => `- ${m}`).join('\n') : '- None specified'}

REQUIRED CONCEPTS (must define):
${context.required_concepts.length > 0 ? context.required_concepts.map(c => `- ${c}`).join('\n') : '- Derive from what_to_teach'}

TERMS TO AVOID (confusing for students):
${context.avoid_terms.length > 0 ? context.avoid_terms.map(t => `- ${t}`).join('\n') : '- None specified'}

TARGET DURATION: ${context.target_duration_minutes} minutes
TARGET STYLE: ${context.target_video_type}
TEACHING UNIT POSITION: ${context.sequence_position} of ${context.total_siblings} in this learning objective
`.trim();
}

// ============================================================================
// PROFESSOR AI SYSTEM PROMPT
// ============================================================================

const PROFESSOR_SYSTEM_PROMPT = `You are an expert university professor creating comprehensive, self-contained lecture slides. You have decades of teaching experience, deep subject matter expertise, and mastery of evidence-based pedagogy.

YOUR MISSION:
Create a complete slide deck that enables DEEP LEARNING. Every slide must provide substantive, textbook-quality content that students can study independently. NO superficial bullet points or vague phrases—only thorough, academically rigorous explanations.

CORE TEACHING PHILOSOPHY:
- Write as if this is the student's PRIMARY learning resource (not supplementary)
- Every concept deserves a proper textbook-style definition followed by detailed explanation
- Abstract ideas must be grounded in concrete, real-world examples with verifiable data
- Build understanding step-by-step, never assuming the student will "figure it out"
- Anticipate confusion and address it proactively

PEDAGOGICAL STRUCTURE:
1. ACTIVATE prior knowledge (connect explicitly to prerequisites they've learned)
2. HOOK with real-world relevance (use specific statistics, case studies, or current events)
3. DEFINE every new term with:
   a) Formal academic definition (as found in authoritative textbooks)
   b) Plain-language explanation of what this means in practice
   c) Why this concept matters in the field
4. EXPLAIN the underlying reasoning (not just WHAT, but WHY and HOW)
5. ILLUSTRATE with concrete examples that include:
   a) Specific real-world scenarios with actual data when possible
   b) Step-by-step walkthrough of application
   c) Connection back to the abstract concept
6. ADDRESS misconceptions explicitly—name the wrong belief, explain why it's wrong, provide the correct understanding
7. SYNTHESIZE by connecting concepts to each other and the bigger picture
8. PREVIEW upcoming content to build anticipation and show learning progression

SLIDE TYPES (use appropriately):
- title: Opening that hooks attention with real-world relevance and clear learning objectives
- hook: Why students should care—use statistics, trends, career implications, or compelling scenarios
- recap: Connect to prerequisites with specific callbacks to prior learning
- definition: COMPREHENSIVE treatment—formal definition + explanation + significance + example
- explanation: Detailed conceptual exploration with reasoning, cause-effect relationships, and context
- example: Rich, detailed real-world application with specific data, names, dates when relevant
- demonstration: Step-by-step walkthrough with explicit reasoning at each step
- process: Multi-step procedures with clear explanations of why each step matters
- misconception: Directly address wrong beliefs—state the misconception, explain why it's wrong, provide correct understanding
- practice: Guided mental exercise with thinking prompts
- synthesis: Connect multiple concepts, show relationships, build bigger picture
- summary: Consolidate key learning points with actionable takeaways
- preview: Foreshadow next topics, create anticipation, show learning path

CONTENT DEPTH REQUIREMENTS:

1. main_text: 3-4 substantive sentences that TEACH, not tease. Include:
   - Core concept or principle being taught
   - Why it matters or how it applies
   - Connection to broader context or real-world implications
   
2. key_points: 4-5 detailed bullet points where each point:
   - Makes a complete, educational statement (not fragments)
   - Explains the WHY behind the WHAT
   - Includes specific details, data, or examples where relevant
   - Stands alone as a learnable piece of information
   
   BAD: "Important for analysis"
   GOOD: "Critical for data analysis because it reveals patterns that would be invisible in raw numbers—for instance, identifying that 80% of customer complaints come from just 20% of product categories enables targeted improvement efforts"

3. definition blocks (when introducing concepts):
   - term: The exact term being defined
   - formal_definition: Textbook-quality definition with precision
   - simple_explanation: Plain-language version with analogy if helpful
   - significance: Why this concept matters in the field (1-2 sentences)
   - example: Brief concrete instance showing the concept in action

4. example blocks (rich and specific):
   - scenario: Detailed, realistic situation with specifics (company names, data, context)
   - walkthrough: Step-by-step explanation of how the concept applies
   - connection_to_concept: Explicit link back to the abstract principle
   - real_world_data: Include actual statistics, case study references, or verifiable facts when possible

5. speaker_notes: 200-300 words of natural, conversational lecture narration that:
   - Sounds like a professor actually speaking to students
   - Adds context, anecdotes, and explanatory depth beyond the slides
   - Anticipates questions students might have
   - Provides additional examples or clarifications
   - Guides students through the material with clear transitions

6. MANDATORY COVERAGE:
   - Every common_misconception from the brief MUST have a dedicated slide
   - Every required_concept MUST be formally defined before use
   - Prerequisites must be explicitly referenced in the recap
   - The enables/next topics must be mentioned in the preview slide

VISUAL DIRECTIVES:
Specify visuals that genuinely enhance understanding:
- type: diagram/screenshot/comparison/flowchart/illustration/chart/infographic/none
- description: Detailed description for AI image generation (be specific about what to show)
- elements: Specific elements that MUST appear, labeled clearly
- style: "clean technical diagram", "annotated screenshot", "minimalist academic", "data visualization", etc.
- educational_purpose: What concept this visual helps explain

QUALITY STANDARDS:
- NO vague phrases like "important for business" or "useful in practice"—be SPECIFIC
- NO unexplained jargon—every technical term gets a definition
- NO orphaned concepts—everything connects to something the student knows
- NO abstract-only explanations—always ground in concrete examples
- NO filler content—every sentence must teach something

OUTPUT FORMAT: JSON with exact structure shown below.`;

// ============================================================================
// PROFESSOR AI - Main content generation
// ============================================================================

async function runProfessorAI(context: TeachingUnitContext): Promise<ProfessorSlide[]> {
  console.log('[Professor AI] Starting lecture generation');

  const lectureBrief = buildLectureBrief(context);
  const targetSlides = Math.max(5, Math.round(context.target_duration_minutes * 1.5));

  const userPrompt = `${lectureBrief}

=== YOUR TASK ===
Create a comprehensive ${targetSlides}-slide lecture deck for this teaching unit.

CRITICAL REQUIREMENTS:
1. Every common_misconception MUST have a dedicated "misconception" slide that:
   - States the wrong belief explicitly
   - Explains WHY students typically believe this
   - Provides the correct understanding with evidence
   
2. Every required_concept MUST be defined with:
   - Formal academic definition (textbook quality)
   - Plain-language explanation
   - Real-world example showing the concept in action
   - Why this concept matters in the field
   
3. Speaker notes MUST be 200-300 words of natural lecture narration that:
   - Sounds like an actual professor speaking
   - Adds depth beyond what's on the slide
   - Anticipates student questions
   
4. Bloom level "${context.learning_objective.bloom_level}" dictates cognitive depth:
   - remember: Emphasize clear definitions, memorable examples, key facts
   - understand: Focus on explanations, reasoning, cause-effect relationships
   - apply: Provide worked examples, step-by-step demonstrations, practical scenarios
   - analyze: Compare/contrast, examine relationships, break down components
   - evaluate: Include criteria for judgment, pros/cons analysis, critical assessment
   - create: Show design processes, synthesis of components, novel applications

5. CONTENT DEPTH:
   - main_text: 3-4 substantive sentences that teach a complete idea
   - key_points: 4-5 detailed bullets, each making a complete educational statement with explanations
   - examples: Use specific, verifiable real-world data (company names, statistics, case studies)
   - NO vague phrases—be specific and educational

6. ADAPTIVE LAYOUT HINTS (AI-driven content presentation):
   For EACH key_point, analyze its semantic structure and provide an optional layout_hint:
   - Describes a sequence/process (A → B → C) → type: "flow", segments: ["Step A", "Step B", "Step C"]
   - Compares two things (X vs Y, X = this; Y = that) → type: "comparison", left_right: ["X", "Y"]
   - Contains formula/relationship (X = Y + Z) → type: "equation", formula: "X = Y + Z"
   - Notable quote or key principle → type: "quote"
   - Important insight or tip → type: "callout"
   - Multiple items in a list → type: "list"
   - Simple paragraph → type: "plain"
   - Always include emphasis_words: 2-4 critical terms to highlight

OUTPUT (JSON array of slides):
{
  "slides": [
    {
      "order": 1,
      "type": "title",
      "title": "Engaging title that frames the learning journey",
      "content": {
        "main_text": "3-4 substantive sentences that introduce the topic...",
        "main_text_layout": {
          "type": "plain",
          "emphasis_words": ["critical term", "key concept"]
        },
        "key_points": [
          "Process: Set Direction → Analyze Environment → Implement → Review",
          "Vision defines the future state; Mission defines present purpose"
        ],
        "key_points_layout": [
          { "type": "flow", "segments": ["Set Direction", "Analyze", "Implement", "Review"] },
          { "type": "comparison", "left_right": ["Vision (Future)", "Mission (Present)"] }
        ]
      },
      "visual_directive": {
        "type": "illustration",
        "description": "Detailed description for image generation",
        "elements": ["element1", "element2"],
        "style": "clean academic",
        "educational_purpose": "What this visual helps students understand"
      },
      "speaker_notes": "200-300 words of natural lecture narration. Start by welcoming students and framing why this topic matters. Provide additional context not on the slide. Anticipate a question students might have. Use a conversational, professorial tone...",
      "estimated_seconds": 90,
      "pedagogy": {
        "purpose": "Hook attention and establish real-world relevance",
        "bloom_action": "activate prior knowledge and create motivation",
        "transition_to_next": "Now that we understand why this matters, let's define the foundational concepts..."
      }
    },
    {
      "order": 2,
      "type": "definition",
      "title": "Defining [Core Concept]",
      "content": {
        "main_text": "Comprehensive introduction to the concept...",
        "main_text_layout": { "type": "plain", "emphasis_words": ["concept name"] },
        "key_points": ["Detailed explanatory points..."],
        "key_points_layout": [{ "type": "plain", "emphasis_words": ["key term"] }],
        "definition": {
          "term": "The exact term",
          "formal_definition": "Precise, textbook-quality definition",
          "simple_explanation": "Plain-language version: Think of it like...",
          "significance": "This concept is fundamental because...",
          "example": "For instance, at [Company X], this concept enabled..."
        }
      },
      "visual_directive": {...},
      "speaker_notes": "200-300 words expanding on the definition...",
      "estimated_seconds": 90,
      "pedagogy": {...}
    }
  ]
}

CRITICAL: Every slide MUST have speaker_notes with 200-300 words. Never leave speaker_notes empty or short.
Generate all ${targetSlides} slides now with RICH, EDUCATIONAL content and LAYOUT HINTS for every key_point.`;

  const result = await callLovableAI(
    'google/gemini-3-pro-preview',
    PROFESSOR_SYSTEM_PROMPT,
    userPrompt,
    0.7
  );

  try {
    const parsed = parseJsonFromAI(result);
    const slides = parsed.slides || parsed;
    
    if (!Array.isArray(slides)) {
      throw new Error('Response is not an array of slides');
    }

    console.log(`[Professor AI] Generated ${slides.length} slides`);
    return slides;
  } catch (error) {
    console.error('[Professor AI] Parse error:', error);
    throw new Error('Failed to parse Professor AI response');
  }
}

// ============================================================================
// VISUAL AI - Generate images for slides
// ============================================================================

async function runVisualAI(
  slides: ProfessorSlide[],
  context: TeachingUnitContext,
  supabase: any
): Promise<Map<number, string>> {
  console.log('[Visual AI] Starting image generation');
  
  const visualUrls = new Map<number, string>();
  
  // Filter slides that need visuals
  const slidesNeedingVisuals = slides.filter(
    s => s.visual_directive?.type && s.visual_directive.type !== 'none'
  );

  console.log(`[Visual AI] ${slidesNeedingVisuals.length} slides need visuals`);

  // Process visuals in parallel (max 3 at a time)
  const batchSize = 3;
  for (let i = 0; i < slidesNeedingVisuals.length; i += batchSize) {
    const batch = slidesNeedingVisuals.slice(i, i + batchSize);
    
    const promises = batch.map(async (slide) => {
      const directive = slide.visual_directive;
      
      const imagePrompt = `Create an educational diagram for a university lecture slide.

TOPIC: ${slide.title}
CONTEXT: ${context.title} - ${context.domain}

REQUIREMENTS:
- Type: ${directive.type}
- Must include: ${directive.elements.join(', ')}
- Description: ${directive.description}
- Style: ${directive.style}

DESIGN RULES:
- Clean, minimal design suitable for projection
- High contrast (works on both light/dark backgrounds)
- Clear labels on all elements
- No decorative elements, pure information
- Professional academic style
- 16:9 aspect ratio
- Large text that's readable from a distance`;

      const result = await generateImage(imagePrompt, slide.title);
      
      if (result?.base64) {
        try {
          // Upload to storage
          const fileName = `slide_${context.id}_${slide.order}_${Date.now()}.png`;
          const { error: uploadError } = await supabase.storage
            .from('lecture-visuals')
            .upload(fileName, base64ToBlob(result.base64), {
              contentType: 'image/png',
              upsert: true,
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('lecture-visuals')
              .getPublicUrl(fileName);
            
            if (urlData?.publicUrl) {
              visualUrls.set(slide.order, urlData.publicUrl);
              console.log(`[Visual AI] Uploaded visual for slide ${slide.order}`);
            }
          } else {
            console.warn(`[Visual AI] Upload failed for slide ${slide.order}:`, uploadError);
          }
        } catch (error) {
          console.warn(`[Visual AI] Storage error for slide ${slide.order}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  console.log(`[Visual AI] Generated ${visualUrls.size} visuals`);
  return visualUrls;
}

function base64ToBlob(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// MERGE SLIDES WITH VISUALS
// ============================================================================

function mergeSlideswithVisuals(
  slides: ProfessorSlide[],
  visualUrls: Map<number, string>
): any[] {
  return slides.map(slide => {
    const visualUrl = visualUrls.get(slide.order);
    
    return {
      order: slide.order,
      type: slide.type,
      title: slide.title,
      content: {
        main_text: slide.content?.main_text || '',
        key_points: slide.content?.key_points || [],
        definition: slide.content?.definition,
        example: slide.content?.example,
        misconception: slide.content?.misconception,
        steps: slide.content?.steps,
      },
      visual: {
        type: slide.visual_directive?.type || 'none',
        url: visualUrl || null,
        alt_text: slide.visual_directive?.description || '',
        fallback_description: slide.visual_directive?.description || '',
        elements: slide.visual_directive?.elements || [],
        style: slide.visual_directive?.style || '',
      },
      speaker_notes: slide.speaker_notes || '',
      speaker_notes_duration_seconds: slide.estimated_seconds || 60,
      pedagogy: slide.pedagogy || {
        purpose: '',
        bloom_action: '',
        transition_to_next: '',
      },
      quality_score: 85, // Default quality score
    };
  });
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function updateProgress(
  supabase: any,
  slideId: string,
  phase: string,
  percent: number,
  message: string
): Promise<void> {
  try {
    await supabase
      .from('lecture_slides')
      .update({
        generation_phases: {
          current_phase: phase,
          progress_percent: percent,
          message,
          updated_at: new Date().toISOString(),
        },
      })
      .eq('id', slideId);
  } catch (error) {
    console.warn('[Progress] Update failed:', error);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { teaching_unit_id, style = 'standard', regenerate = false } = await req.json();
    
    if (!teaching_unit_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'teaching_unit_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Main] === PROFESSOR AI v3 === Starting for: ${teaching_unit_id}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth from request
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    // PHASE 1: Fetch complete context
    console.log('[Main] === PHASE 1: CONTEXT GATHERING ===');
    const context = await fetchTeachingUnitContext(supabase, teaching_unit_id);

    // Check for existing slides
    const { data: existingRecord } = await supabase
      .from('lecture_slides')
      .select('id')
      .eq('teaching_unit_id', teaching_unit_id)
      .maybeSingle();

    let slideRecordId: string;

    if (existingRecord && !regenerate) {
      const { data: updated, error: updateErr } = await supabase
        .from('lecture_slides')
        .update({
          status: 'generating',
          error_message: null,
          slide_style: style,
          generation_phases: { 
            started: new Date().toISOString(), 
            current_phase: 'professor', 
            progress_percent: 0,
            version: 3,
          },
        })
        .eq('id', existingRecord.id)
        .select('id')
        .single();

      if (updateErr) throw updateErr;
      slideRecordId = updated.id;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('lecture_slides')
        .insert({
          teaching_unit_id,
          learning_objective_id: context.learning_objective.id,
          instructor_course_id: context.course.id,
          title: context.title,
          status: 'generating',
          slide_style: style,
          created_by: userId,
          generation_phases: { 
            started: new Date().toISOString(), 
            current_phase: 'professor', 
            progress_percent: 0,
            version: 3,
          },
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      slideRecordId = inserted.id;
    }

    console.log('[Main] Slide record:', slideRecordId);

    try {
      // PHASE 2: Professor AI - Complete lecture generation
      console.log('[Main] === PHASE 2: PROFESSOR AI ===');
      await updateProgress(supabase, slideRecordId, 'professor', 10, 'Professor AI: Crafting your lecture...');
      
      const slides = await runProfessorAI(context);
      await updateProgress(supabase, slideRecordId, 'professor', 60, `Generated ${slides.length} slides`);
      
      console.log('[Main] Professor AI complete:', slides.length, 'slides');

      // PHASE 3: Save slides FIRST (before image generation to avoid timeout)
      console.log('[Main] === PHASE 3: SAVING SLIDES ===');
      await updateProgress(supabase, slideRecordId, 'finalize', 70, 'Saving lecture content...');
      
      // Build initial slides without visuals - include layout hints from AI
      const initialSlides = slides.map(slide => ({
        order: slide.order,
        type: slide.type,
        title: slide.title,
        content: {
          main_text: slide.content?.main_text || '',
          main_text_layout: slide.content?.main_text_layout || { type: 'plain' },
          key_points: slide.content?.key_points || [],
          key_points_layout: slide.content?.key_points_layout || [],
          definition: slide.content?.definition,
          example: slide.content?.example,
          misconception: slide.content?.misconception,
          steps: slide.content?.steps,
        },
        visual: {
          type: slide.visual_directive?.type || 'none',
          url: null, // Will be populated by async image generation
          alt_text: slide.visual_directive?.description || '',
          fallback_description: slide.visual_directive?.description || '',
          elements: slide.visual_directive?.elements || [],
          style: slide.visual_directive?.style || '',
        },
        speaker_notes: slide.speaker_notes || '',
        speaker_notes_duration_seconds: slide.estimated_seconds || 60,
        pedagogy: slide.pedagogy || {
          purpose: '',
          bloom_action: '',
          transition_to_next: '',
        },
        quality_score: 80,
      }));

      // Calculate initial quality score
      const avgSpeakerNotesLength = initialSlides.reduce(
        (sum, s) => sum + (s.speaker_notes?.length || 0), 0
      ) / initialSlides.length;
      
      let qualityScore = 70;
      if (avgSpeakerNotesLength > 500) qualityScore += 10;
      if (initialSlides.some(s => s.type === 'misconception')) qualityScore += 5;
      if (initialSlides.some(s => s.content?.definition)) qualityScore += 5;

      // Save slides immediately (before image generation)
      const { error: saveError } = await supabase
        .from('lecture_slides')
        .update({
          slides: initialSlides,
          total_slides: initialSlides.length,
          status: 'ready', // Mark as ready - images are optional
          generation_phases: {
            version: 3,
            slides_saved: new Date().toISOString(),
            current_phase: 'visual',
            progress_percent: 75,
            message: 'Slides ready. Generating visuals...',
          },
          quality_score: qualityScore,
          is_research_grounded: false,
          estimated_duration_minutes: Math.round(initialSlides.length * 1.5),
          generation_model: 'google/gemini-3-pro-preview',
        })
        .eq('id', slideRecordId);

      if (saveError) {
        console.error('[Main] Save error:', saveError);
        throw saveError;
      }

      console.log('[Main] Slides saved successfully:', initialSlides.length);

      // PHASE 4: Visual AI - Generate images for ALL slides that need them
      console.log('[Main] === PHASE 4: VISUAL AI ===');
      
      // Get all slides that need visuals
      const slidesNeedingVisuals = slides
        .filter(s => s.visual_directive?.type && s.visual_directive.type !== 'none');
      
      console.log(`[Visual AI] Generating visuals for ${slidesNeedingVisuals.length} slides`);
      
      // Generate visuals in parallel (all at once for speed)
      const visualPromises = slidesNeedingVisuals.map(async (slide) => {
        const directive = slide.visual_directive;
        
        const imagePrompt = `Create an educational diagram for a university lecture slide.

TOPIC: ${slide.title}
CONTEXT: ${context.title} - ${context.domain}

REQUIREMENTS:
- Type: ${directive.type}
- Must include: ${directive.elements.join(', ')}
- Description: ${directive.description}
- Style: ${directive.style}

DESIGN RULES:
- Clean, minimal design suitable for projection
- High contrast (works on both light/dark backgrounds)
- Clear labels on all elements
- No decorative elements, pure information
- Professional academic style
- 16:9 aspect ratio`;

        try {
          const result = await generateImage(imagePrompt, slide.title);
          
          if (result?.base64) {
            const fileName = `slide_${context.id}_${slide.order}_${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage
              .from('lecture-visuals')
              .upload(fileName, base64ToBlob(result.base64), {
                contentType: 'image/png',
                upsert: true,
              });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('lecture-visuals')
                .getPublicUrl(fileName);
              
              if (urlData?.publicUrl) {
                console.log(`[Visual AI] Uploaded visual for slide ${slide.order}`);
                return { order: slide.order, url: urlData.publicUrl };
              }
            }
          }
        } catch (error) {
          console.warn(`[Visual AI] Error for slide ${slide.order}:`, error);
        }
        return null;
      });

      // Wait for all visuals with a timeout
      const visualResults = await Promise.allSettled(visualPromises);
      const successfulVisuals = visualResults
        .filter((r): r is PromiseFulfilledResult<{ order: number; url: string } | null> => 
          r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value!);

      console.log(`[Visual AI] Generated ${successfulVisuals.length} visuals`);

      // Update slides with visual URLs if any were generated
      if (successfulVisuals.length > 0) {
        const updatedSlides = initialSlides.map(slide => {
          const visual = successfulVisuals.find(v => v.order === slide.order);
          if (visual) {
            return {
              ...slide,
              visual: {
                ...slide.visual,
                url: visual.url,
              },
              quality_score: 90, // Boost quality for slides with images
            };
          }
          return slide;
        });

        // Update with visuals
        await supabase
          .from('lecture_slides')
          .update({
            slides: updatedSlides,
            quality_score: qualityScore + (successfulVisuals.length > 3 ? 10 : successfulVisuals.length * 2),
            generation_phases: {
              version: 3,
              completed: new Date().toISOString(),
              total_duration_ms: Date.now() - startTime,
              current_phase: 'complete',
              progress_percent: 100,
              visuals_generated: successfulVisuals.length,
            },
          })
          .eq('id', slideRecordId);
      }

      const duration = Date.now() - startTime;
      console.log(`[Main] === COMPLETE === ${duration}ms, ${initialSlides.length} slides, ${successfulVisuals.length} visuals`);

      return new Response(
        JSON.stringify({
          success: true,
          slideId: slideRecordId,
          slideCount: initialSlides.length,
          visualCount: successfulVisuals.length,
          qualityScore: qualityScore + (successfulVisuals.length > 3 ? 10 : 0),
          durationMs: duration,
          version: 3,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (agentError) {
      console.error('[Main] Agent error:', agentError);
      
      await supabase
        .from('lecture_slides')
        .update({
          status: 'failed',
          error_message: agentError instanceof Error ? agentError.message : 'Unknown error',
        })
        .eq('id', slideRecordId);

      throw agentError;
    }

  } catch (error) {
    console.error('[Main] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
