import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPE DEFINITIONS - Professor AI v3
// ============================================================================

interface ProfessorSlide {
  order: number;
  type: 'title' | 'hook' | 'recap' | 'definition' | 'explanation' | 
        'example' | 'demonstration' | 'misconception' | 'practice' | 
        'synthesis' | 'preview' | 'process' | 'summary';
  title: string;
  content: {
    main_text: string;
    key_points?: string[];
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

const PROFESSOR_SYSTEM_PROMPT = `You are an expert university professor creating autonomous lecture slides. You have decades of teaching experience and deep knowledge of pedagogy.

YOUR MISSION:
Create a complete slide deck that a student could use to LEARN INDEPENDENTLY without an instructor present. Each slide must teach effectively on its own.

PEDAGOGICAL PRINCIPLES:
1. START with activation (connect to what student already knows from prerequisites)
2. HOOK - make them care about WHY this matters for their goals
3. DEFINE all required concepts formally before using them
4. EXPLAIN with clear reasoning, not just facts
5. ILLUSTRATE with concrete, relatable examples
6. ADDRESS misconceptions directly - students WILL have these wrong beliefs
7. SYNTHESIZE key takeaways explicitly
8. PREVIEW what comes next to build anticipation

SLIDE TYPES:
- title: Opening hook with relevance to student goals
- hook: Why should students care? Connect to real-world impact
- recap: Brief review of prerequisites (assume these are known)
- definition: Formal definition with simple explanation
- explanation: Detailed conceptual explanation with reasoning
- example: Concrete real-world application
- demonstration: Step-by-step walkthrough
- misconception: Address wrong beliefs directly
- practice: Mental exercise or check-for-understanding
- synthesis: Connect ideas together
- summary: Key takeaways (3-5 points)
- preview: What comes next in the learning sequence

CONTENT QUALITY REQUIREMENTS:
1. main_text: 2-3 sentences of substantive content (not filler)
2. key_points: 3-5 bullet points that EXPLAIN, not just list
3. speaker_notes: 150-250 words of NATURAL lecture narration (as if speaking to students)
4. Every misconception from the brief MUST have its own dedicated slide
5. Every required_concept MUST be defined before use
6. References to prerequisites show continuity
7. Preview slide references the enables/next units

VISUAL DIRECTIVES:
For each slide, specify what visual would help learning:
- type: diagram/screenshot/comparison/flowchart/illustration/none
- description: Detailed description for AI image generation
- elements: Specific elements that MUST appear
- style: "clean technical", "annotated", "minimalist academic", etc.

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
Create a ${targetSlides}-slide lecture deck for this teaching unit.

REQUIREMENTS:
1. Every common_misconception MUST have a dedicated slide
2. Every required_concept MUST be defined before use
3. Speaker notes MUST be 150-250 words (natural lecture narration)
4. Bloom level "${context.learning_objective.bloom_level}" dictates cognitive actions:
   - remember: recall, identify, list
   - understand: explain, summarize, describe
   - apply: use, implement, demonstrate
   - analyze: compare, differentiate, examine
   - evaluate: judge, critique, assess
   - create: design, construct, develop

OUTPUT (JSON array of slides):
{
  "slides": [
    {
      "order": 1,
      "type": "title",
      "title": "Engaging title that hooks attention",
      "content": {
        "main_text": "2-3 sentences introducing the topic and its relevance",
        "key_points": ["Why this matters point 1", "Why this matters point 2"]
      },
      "visual_directive": {
        "type": "illustration",
        "description": "Detailed description for image generation",
        "elements": ["element1", "element2"],
        "style": "clean academic"
      },
      "speaker_notes": "150-250 words of natural lecture narration as if speaking to students...",
      "estimated_seconds": 60,
      "pedagogy": {
        "purpose": "Hook attention and establish relevance",
        "bloom_action": "recall prior knowledge",
        "transition_to_next": "Now that we understand why this matters, let's define the key terms..."
      }
    }
  ]
}

Generate all ${targetSlides} slides now.`;

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
      
      // Build initial slides without visuals
      const initialSlides = slides.map(slide => ({
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

      // PHASE 4: Visual AI - Generate images (best effort, won't block)
      // We limit to first 5 slides to stay under timeout
      console.log('[Main] === PHASE 4: VISUAL AI (limited) ===');
      
      const maxVisualsToGenerate = 5;
      const slidesNeedingVisuals = slides
        .filter(s => s.visual_directive?.type && s.visual_directive.type !== 'none')
        .slice(0, maxVisualsToGenerate);
      
      console.log(`[Visual AI] Generating ${slidesNeedingVisuals.length} visuals (capped at ${maxVisualsToGenerate})`);
      
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
