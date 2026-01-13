import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface EnhancedSlide {
  order: number;
  type: 'title' | 'definition' | 'explanation' | 'example' | 'process' | 
        'diagram' | 'misconception' | 'case_study' | 'summary' | 'assessment';
  title: string;
  content: {
    main_text: string;
    bullets?: string[];
    definition?: {
      term: string;
      meaning: string;
      source: string;
    };
    steps?: {
      step: number;
      title: string;
      explanation: string;
    }[];
    example?: {
      scenario: string;
      explanation: string;
      source?: string;
    };
  };
  visual: {
    type: 'diagram' | 'image' | 'chart' | 'none';
    url?: string;
    alt_text: string;
    source?: string;
    fallback_description: string;
  };
  speaker_notes: string;
  speaker_notes_duration_seconds: number;
  citations: {
    claim: string;
    source: string;
    url?: string;
  }[];
}

interface ResearchResults {
  definitions: { term: string; meaning: string; source: string; url?: string }[];
  examples: { scenario: string; explanation: string; source: string }[];
  processes: { steps: { step: number; title: string; explanation: string }[] }[];
  misconceptions: { misconception: string; correction: string; source?: string }[];
  allCitations: { title: string; url: string; snippet: string }[];
  rawContent: string;
}

interface VisualResults {
  diagrams: { url: string; title: string; source: string; alt_text: string }[];
  images: { url: string; title: string; source: string; alt_text: string }[];
}

interface SlideBlueprint {
  slides: {
    order: number;
    type: string;
    title: string;
    content_guidance: string;
    use_research: { definitions?: number[]; examples?: number[]; processes?: number[] };
    use_visual?: number;
    pedagogical_purpose: string;
  }[];
  reasoning: string;
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
  learning_objective: {
    text: string;
    bloom_level: string;
    core_concept: string;
  };
  module: {
    title: string;
    description: string;
  };
  course: {
    title: string;
    detected_domain: string;
  };
}

// ============================================================================
// AI GATEWAY HELPER
// ============================================================================

async function callLovableAI(
  model: string, 
  systemPrompt: string, 
  userPrompt: string,
  temperature: number = 0.7
): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  console.log(`[AI] Calling ${model} with ${userPrompt.length} chars prompt`);
  
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
    console.error(`[AI] Error from ${model}:`, response.status, errText);
    throw new Error(`AI call failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) throw new Error('No content in AI response');
  
  console.log(`[AI] ${model} returned ${content.length} chars`);
  return content;
}

function parseJsonFromAI(content: string): any {
  // Extract JSON from markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  return JSON.parse(jsonStr);
}

// ============================================================================
// PHASE 1: RESEARCH AGENT (Uses Firecrawl for web search)
// ============================================================================

async function runResearchAgent(context: TeachingUnitContext): Promise<ResearchResults> {
  console.log('[Research Agent] Starting research for:', context.title);
  
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    console.warn('[Research Agent] Firecrawl not configured, using fallback');
    return generateFallbackResearch(context);
  }

  // Build research queries - use teaching unit's curated queries + generated ones
  const queries = [
    `${context.title} definition ${context.domain || 'academic'}`,
    `${context.what_to_teach} explained examples`,
    `${context.title} step by step process tutorial`,
    ...(context.search_queries || []).slice(0, 3),
  ].filter(Boolean).slice(0, 5);

  console.log('[Research Agent] Searching with queries:', queries);

  const allResults: any[] = [];
  
  for (const query of queries) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: 5,
          scrapeOptions: { formats: ['markdown'] },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          allResults.push(...data.data);
        }
      }
    } catch (error) {
      console.warn(`[Research Agent] Query failed: ${query}`, error);
    }
  }

  console.log(`[Research Agent] Collected ${allResults.length} search results`);

  if (allResults.length === 0) {
    return generateFallbackResearch(context);
  }

  // Use AI to extract structured information from search results
  const extractionPrompt = `You are extracting educational content from web search results about "${context.title}".

SEARCH RESULTS:
${allResults.map((r, i) => `
--- Result ${i + 1} ---
Title: ${r.title || 'Unknown'}
URL: ${r.url || 'Unknown'}
Content: ${(r.markdown || r.description || '').slice(0, 2000)}
`).join('\n')}

TEACHING CONTEXT:
- Topic: ${context.title}
- What to teach: ${context.what_to_teach}
- Domain: ${context.domain || context.course?.detected_domain || 'general'}
- Misconceptions to address: ${context.common_misconceptions?.join(', ') || 'none specified'}

Extract and structure the following (use ONLY information from the search results, cite sources):

OUTPUT FORMAT (JSON):
{
  "definitions": [
    { "term": "the concept", "meaning": "complete definition from source", "source": "source name", "url": "url" }
  ],
  "examples": [
    { "scenario": "real example description", "explanation": "why this example illustrates the concept", "source": "source name" }
  ],
  "processes": [
    { "steps": [{ "step": 1, "title": "step title", "explanation": "detailed explanation" }] }
  ],
  "misconceptions": [
    { "misconception": "common wrong belief", "correction": "the correct understanding", "source": "source" }
  ],
  "key_facts": [
    { "fact": "important fact", "source": "source name", "url": "url" }
  ]
}

Extract at least 2 definitions, 3 examples, and identify any step-by-step processes if applicable.`;

  try {
    const extractionResult = await callLovableAI(
      'google/gemini-2.5-flash',
      'You are an educational content extractor. Extract structured, cited information from search results.',
      extractionPrompt,
      0.3
    );

    const extracted = parseJsonFromAI(extractionResult);
    
    return {
      definitions: extracted.definitions || [],
      examples: extracted.examples || [],
      processes: extracted.processes || [],
      misconceptions: extracted.misconceptions || [],
      allCitations: allResults.map(r => ({
        title: r.title || 'Unknown',
        url: r.url || '',
        snippet: (r.description || '').slice(0, 200),
      })),
      rawContent: allResults.map(r => r.markdown || r.description || '').join('\n\n'),
    };
  } catch (error) {
    console.error('[Research Agent] Extraction failed:', error);
    return generateFallbackResearch(context);
  }
}

function generateFallbackResearch(context: TeachingUnitContext): ResearchResults {
  console.log('[Research Agent] Using fallback research generation');
  return {
    definitions: [],
    examples: [],
    processes: [],
    misconceptions: context.common_misconceptions?.map(m => ({
      misconception: m,
      correction: 'To be determined',
    })) || [],
    allCitations: [],
    rawContent: '',
  };
}

// ============================================================================
// PHASE 2: VISUAL DISCOVERY AGENT
// ============================================================================

async function runVisualDiscoveryAgent(context: TeachingUnitContext): Promise<VisualResults> {
  console.log('[Visual Agent] Searching for visual resources');
  
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    console.warn('[Visual Agent] Firecrawl not configured');
    return { diagrams: [], images: [] };
  }

  const visualQueries = [
    `${context.title} diagram site:wikimedia.org`,
    `${context.title} infographic educational`,
    `${context.title} ${context.domain || ''} illustration`,
  ].filter(Boolean);

  const allVisuals: any[] = [];

  for (const query of visualQueries.slice(0, 2)) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: 3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          allVisuals.push(...data.data);
        }
      }
    } catch (error) {
      console.warn(`[Visual Agent] Query failed: ${query}`, error);
    }
  }

  // Extract image URLs from results
  const diagrams: VisualResults['diagrams'] = [];
  const images: VisualResults['images'] = [];

  for (const result of allVisuals) {
    if (result.url?.includes('wikimedia') || result.url?.includes('wikipedia')) {
      diagrams.push({
        url: result.url,
        title: result.title || context.title,
        source: 'Wikimedia Commons',
        alt_text: `Diagram illustrating ${context.title}`,
      });
    } else if (result.url) {
      images.push({
        url: result.url,
        title: result.title || context.title,
        source: new URL(result.url).hostname,
        alt_text: `Image related to ${context.title}`,
      });
    }
  }

  console.log(`[Visual Agent] Found ${diagrams.length} diagrams, ${images.length} images`);
  return { diagrams, images };
}

// ============================================================================
// PHASE 3: CURRICULUM AGENT (GPT-5.2 for pedagogical reasoning)
// ============================================================================

async function runCurriculumAgent(
  context: TeachingUnitContext,
  research: ResearchResults,
  visuals: VisualResults
): Promise<SlideBlueprint> {
  console.log('[Curriculum Agent] Designing slide structure');

  const targetSlides = Math.round(context.target_duration_minutes * 1.2);

  const systemPrompt = `You are an expert instructional designer specializing in ${context.domain || 'general education'}.
Your task is to design the optimal pedagogical sequence for a lecture on "${context.title}".

DESIGN PRINCIPLES:
1. Start with activation of prior knowledge (connect to prerequisites)
2. Introduce new concepts with clear DEFINITIONS first
3. Follow definitions with detailed EXPLANATIONS
4. Use real-world EXAMPLES to illustrate concepts
5. Address MISCONCEPTIONS explicitly where they exist
6. For procedural knowledge, show STEP-BY-STEP processes
7. Include VISUALS where they aid understanding
8. End with SYNTHESIS and self-assessment

SLIDE TYPES AVAILABLE:
- title: Opening slide with topic introduction
- definition: Formal definition of key terms
- explanation: Detailed conceptual explanation
- example: Real-world application or case study
- process: Step-by-step procedure or methodology
- diagram: Visual explanation with supporting text
- misconception: Common errors and corrections
- case_study: In-depth example analysis
- summary: Key takeaways and synthesis
- assessment: Self-check question for learner`;

  const userPrompt = `Design a ${targetSlides}-slide lecture blueprint for:

TEACHING UNIT: "${context.title}"
WHAT TO TEACH: ${context.what_to_teach}
WHY IT MATTERS: ${context.why_this_matters}
HOW TO TEACH: ${context.how_to_teach || 'standard lecture format'}

PREREQUISITES: ${context.prerequisites?.join(', ') || 'none specified'}
ENABLES (next concepts): ${context.enables?.join(', ') || 'none specified'}
MISCONCEPTIONS TO ADDRESS: ${context.common_misconceptions?.join('; ') || 'none specified'}

TARGET DURATION: ${context.target_duration_minutes} minutes
BLOOM LEVEL: ${context.learning_objective?.bloom_level || 'understand'}

AVAILABLE RESEARCH:
- Definitions found: ${research.definitions.length}
- Examples found: ${research.examples.length}
- Processes found: ${research.processes.length}
- Citations available: ${research.allCitations.length}

AVAILABLE VISUALS:
- Diagrams: ${visuals.diagrams.length}
- Images: ${visuals.images.length}

Create a pedagogically sound slide sequence. For each slide, specify:
1. The slide type
2. A clear title
3. What content to include
4. Which research items to use (by index)
5. The pedagogical purpose

OUTPUT FORMAT (JSON):
{
  "slides": [
    {
      "order": 1,
      "type": "title",
      "title": "Slide title",
      "content_guidance": "What this slide should contain and teach",
      "use_research": { "definitions": [0], "examples": [], "processes": [] },
      "use_visual": null,
      "pedagogical_purpose": "Why this slide is here in the sequence"
    }
  ],
  "reasoning": "Brief explanation of the pedagogical rationale for this sequence"
}`;

  const result = await callLovableAI('openai/gpt-5.2', systemPrompt, userPrompt, 0.7);
  
  try {
    return parseJsonFromAI(result);
  } catch (error) {
    console.error('[Curriculum Agent] Parse error, generating default blueprint');
    return generateDefaultBlueprint(context, targetSlides);
  }
}

function generateDefaultBlueprint(context: TeachingUnitContext, targetSlides: number): SlideBlueprint {
  const slides = [
    { order: 1, type: 'title', title: context.title, content_guidance: 'Introduction', use_research: {}, pedagogical_purpose: 'Hook attention' },
    { order: 2, type: 'definition', title: `What is ${context.title}?`, content_guidance: 'Core definition', use_research: { definitions: [0] }, pedagogical_purpose: 'Establish foundation' },
    { order: 3, type: 'explanation', title: 'Key Concepts', content_guidance: 'Detailed explanation', use_research: {}, pedagogical_purpose: 'Build understanding' },
    { order: 4, type: 'example', title: 'Real-World Example', content_guidance: 'Practical application', use_research: { examples: [0] }, pedagogical_purpose: 'Connect to reality' },
    { order: 5, type: 'summary', title: 'Key Takeaways', content_guidance: 'Synthesis', use_research: {}, pedagogical_purpose: 'Consolidate learning' },
  ];
  
  return {
    slides: slides.slice(0, Math.max(targetSlides, 5)),
    reasoning: 'Default pedagogical sequence: introduction, definition, explanation, example, summary',
  };
}

// ============================================================================
// PHASE 4: CONTENT SYNTHESIS AGENT (Gemini 2.5 Pro for large context)
// ============================================================================

async function runSynthesisAgent(
  context: TeachingUnitContext,
  blueprint: SlideBlueprint,
  research: ResearchResults,
  visuals: VisualResults
): Promise<EnhancedSlide[]> {
  console.log('[Synthesis Agent] Generating detailed slide content');

  const systemPrompt = `You are an expert educational content writer creating lecture slides that can teach autonomously.

CRITICAL RULES:
1. Use information from the provided research - CITE sources
2. Speaker notes must be COMPLETE narration scripts (150-300 words each)
3. Each slide teaches ONE focused concept thoroughly
4. Include specific examples and concrete explanations
5. Make content self-explanatory for a student studying alone
6. Use the visual resources when available

CONTENT QUALITY STANDARDS:
- Definitions: Complete, formal, with source attribution
- Explanations: Step-by-step, clear, with reasoning
- Examples: Specific, relatable, with clear connection to concept
- Speaker notes: Natural spoken language, as if lecturing to students`;

  const userPrompt = `Create complete educational slides based on this blueprint and research.

TEACHING UNIT: "${context.title}"
DOMAIN: ${context.domain || context.course?.detected_domain || 'general'}
LEARNING OBJECTIVE: ${context.learning_objective?.text}
BLOOM LEVEL: ${context.learning_objective?.bloom_level || 'understand'}

SLIDE BLUEPRINT:
${JSON.stringify(blueprint.slides, null, 2)}

RESEARCH CONTENT:
Definitions: ${JSON.stringify(research.definitions)}
Examples: ${JSON.stringify(research.examples)}
Processes: ${JSON.stringify(research.processes)}
Misconceptions: ${JSON.stringify(research.misconceptions)}

AVAILABLE VISUALS:
${JSON.stringify([...visuals.diagrams, ...visuals.images].slice(0, 5))}

CITATIONS AVAILABLE:
${JSON.stringify(research.allCitations.slice(0, 10))}

For EACH slide in the blueprint, generate complete content following this exact structure:

{
  "slides": [
    {
      "order": 1,
      "type": "definition",
      "title": "What is Strategic Management?",
      "content": {
        "main_text": "Strategic management is a comprehensive approach to formulating, implementing, and evaluating decisions that enable an organization to achieve its long-term objectives. It involves analyzing both internal capabilities and external competitive environment to create sustainable competitive advantage.",
        "bullets": ["Key point 1", "Key point 2"],
        "definition": {
          "term": "Strategic Management",
          "meaning": "The continuous planning, monitoring, analysis, and assessment of all necessities an organization needs to meet its goals and objectives.",
          "source": "Harvard Business Review"
        }
      },
      "visual": {
        "type": "diagram",
        "url": "https://...",
        "alt_text": "AFI Framework showing Analysis, Formulation, Implementation cycle",
        "source": "Wikimedia Commons",
        "fallback_description": "A circular diagram showing three interconnected phases: Analysis, Formulation, and Implementation"
      },
      "speaker_notes": "Let's begin by understanding what strategic management really means. [Continue for 150-300 words with natural lecture narration]...",
      "speaker_notes_duration_seconds": 60,
      "citations": [
        { "claim": "Strategic management enables competitive advantage", "source": "Porter, M. (1985)", "url": "..." }
      ]
    }
  ]
}

Generate all ${blueprint.slides.length} slides with complete, educational content.`;

  const result = await callLovableAI('google/gemini-2.5-pro', systemPrompt, userPrompt, 0.7);
  
  try {
    const parsed = parseJsonFromAI(result);
    return parsed.slides || [];
  } catch (error) {
    console.error('[Synthesis Agent] Parse error:', error);
    throw new Error('Failed to generate slide content');
  }
}

// ============================================================================
// PHASE 5: QUALITY AGENT (Gemini Flash for fast validation)
// ============================================================================

async function runQualityAgent(
  slides: EnhancedSlide[],
  context: TeachingUnitContext
): Promise<{ slides: EnhancedSlide[]; overallScore: number; issues: string[] }> {
  console.log('[Quality Agent] Validating slide quality');

  const systemPrompt = `You are an educational quality assurance specialist. Validate lecture slides for completeness, accuracy, and pedagogical effectiveness.`;

  const userPrompt = `Validate these ${slides.length} slides for teaching "${context.title}".

TEACHING REQUIREMENTS:
- Must teach: ${context.what_to_teach}
- Must address misconceptions: ${context.common_misconceptions?.join(', ') || 'none'}
- Target duration: ${context.target_duration_minutes} minutes
- Bloom level: ${context.learning_objective?.bloom_level || 'understand'}

SLIDES TO VALIDATE:
${JSON.stringify(slides, null, 2)}

For each slide, check:
1. Content completeness (definition/explanation/example as appropriate for type)
2. Speaker notes length (should be 150-300 words for self-study)
3. Visual description present
4. Pedagogical appropriateness for bloom level

OUTPUT FORMAT (JSON):
{
  "validation": [
    {
      "slide_order": 1,
      "is_valid": true,
      "quality_score": 85,
      "issues": [],
      "speaker_notes_word_count": 180
    }
  ],
  "overall_score": 85,
  "missing_content": ["List any critical missing elements"],
  "strengths": ["List what's done well"]
}`;

  try {
    const result = await callLovableAI('google/gemini-2.5-flash', systemPrompt, userPrompt, 0.3);
    const validation = parseJsonFromAI(result);
    
    // Attach quality scores to slides
    const scoredSlides = slides.map((slide, i) => ({
      ...slide,
      quality_score: validation.validation?.[i]?.quality_score || 70,
    }));

    return {
      slides: scoredSlides,
      overallScore: validation.overall_score || 70,
      issues: validation.missing_content || [],
    };
  } catch (error) {
    console.warn('[Quality Agent] Validation failed, using defaults');
    return {
      slides: slides.map(s => ({ ...s, quality_score: 70 })),
      overallScore: 70,
      issues: ['Quality validation could not be completed'],
    };
  }
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function updateProgress(
  supabase: any,
  slideId: string,
  phase: string,
  percent: number,
  phases: Record<string, any>
): Promise<void> {
  try {
    await supabase
      .from('lecture_slides')
      .update({
        generation_phases: {
          ...phases,
          [phase]: { status: 'complete', timestamp: new Date().toISOString() },
          current_phase: phase,
          progress_percent: percent,
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
    const { teaching_unit_id, style = 'professional', regenerate = false } = await req.json();
    
    if (!teaching_unit_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'teaching_unit_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Main] Starting multi-agent generation for teaching unit: ${teaching_unit_id}`);

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

    // Fetch full teaching unit context
    const { data: unit, error: unitError } = await supabase
      .from('teaching_units')
      .select(`
        *,
        learning_objective:learning_objectives!inner(
          id,
          text,
          bloom_level,
          core_concept,
          module:modules!inner(
            id,
            title,
            description,
            instructor_course:instructor_courses!inner(
              id,
              title,
              detected_domain
            )
          )
        )
      `)
      .eq('id', teaching_unit_id)
      .single();

    if (unitError || !unit) {
      console.error('[Main] Teaching unit not found:', unitError);
      return new Response(
        JSON.stringify({ success: false, error: 'Teaching unit not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lo = unit.learning_objective;
    const module = lo.module;
    const course = module.instructor_course;

    // Build context object
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
      learning_objective: {
        text: lo.text,
        bloom_level: lo.bloom_level || 'understand',
        core_concept: lo.core_concept || '',
      },
      module: {
        title: module.title,
        description: module.description || '',
      },
      course: {
        title: course.title,
        detected_domain: course.detected_domain || '',
      },
    };

    console.log('[Main] Context built:', {
      title: context.title,
      duration: context.target_duration_minutes,
      searchQueries: context.search_queries.length,
      misconceptions: context.common_misconceptions.length,
    });

    // Check for existing slides
    const { data: existingRecord } = await supabase
      .from('lecture_slides')
      .select('id')
      .eq('teaching_unit_id', teaching_unit_id)
      .maybeSingle();

    let slideRecordId: string;
    const phases: Record<string, any> = {};

    if (existingRecord && !regenerate) {
      // Update existing
      const { data: updated, error: updateErr } = await supabase
        .from('lecture_slides')
        .update({
          status: 'generating',
          error_message: null,
          generation_phases: { started: new Date().toISOString(), current_phase: 'research', progress_percent: 0 },
        })
        .eq('id', existingRecord.id)
        .select('id')
        .single();

      if (updateErr) throw updateErr;
      slideRecordId = updated.id;
    } else {
      // Create new
      const { data: inserted, error: insertErr } = await supabase
        .from('lecture_slides')
        .insert({
          teaching_unit_id,
          learning_objective_id: lo.id,
          instructor_course_id: course.id,
          title: unit.title,
          status: 'generating',
          slide_style: style,
          created_by: userId,
          generation_phases: { started: new Date().toISOString(), current_phase: 'research', progress_percent: 0 },
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      slideRecordId = inserted.id;
    }

    console.log('[Main] Slide record created/updated:', slideRecordId);

    try {
      // PHASE 1: Research Agent
      console.log('[Main] === PHASE 1: RESEARCH AGENT ===');
      const researchResults = await runResearchAgent(context);
      await updateProgress(supabase, slideRecordId, 'research', 20, phases);
      console.log('[Main] Research complete:', {
        definitions: researchResults.definitions.length,
        examples: researchResults.examples.length,
        citations: researchResults.allCitations.length,
      });

      // PHASE 2: Visual Discovery Agent
      console.log('[Main] === PHASE 2: VISUAL DISCOVERY AGENT ===');
      const visualResults = await runVisualDiscoveryAgent(context);
      await updateProgress(supabase, slideRecordId, 'visual', 35, phases);
      console.log('[Main] Visual discovery complete:', {
        diagrams: visualResults.diagrams.length,
        images: visualResults.images.length,
      });

      // PHASE 3: Curriculum Agent
      console.log('[Main] === PHASE 3: CURRICULUM AGENT ===');
      const blueprint = await runCurriculumAgent(context, researchResults, visualResults);
      await updateProgress(supabase, slideRecordId, 'curriculum', 50, phases);
      console.log('[Main] Curriculum complete:', {
        slides: blueprint.slides.length,
        reasoning: blueprint.reasoning?.slice(0, 100),
      });

      // PHASE 4: Content Synthesis Agent
      console.log('[Main] === PHASE 4: CONTENT SYNTHESIS AGENT ===');
      const slides = await runSynthesisAgent(context, blueprint, researchResults, visualResults);
      await updateProgress(supabase, slideRecordId, 'synthesis', 80, phases);
      console.log('[Main] Synthesis complete:', slides.length, 'slides generated');

      // PHASE 5: Quality Agent
      console.log('[Main] === PHASE 5: QUALITY AGENT ===');
      const { slides: validatedSlides, overallScore, issues } = await runQualityAgent(slides, context);
      await updateProgress(supabase, slideRecordId, 'quality', 100, phases);
      console.log('[Main] Quality validation complete:', { overallScore, issues: issues.length });

      // Calculate citation count
      const citationCount = validatedSlides.reduce(
        (sum, slide) => sum + (slide.citations?.length || 0),
        0
      );

      // Save final slides
      const { error: saveError } = await supabase
        .from('lecture_slides')
        .update({
          slides: validatedSlides,
          total_slides: validatedSlides.length,
          status: 'ready',
          research_context: {
            definitions: researchResults.definitions,
            examples: researchResults.examples,
            citations: researchResults.allCitations,
          },
          generation_phases: {
            ...phases,
            completed: new Date().toISOString(),
            total_duration_ms: Date.now() - startTime,
          },
          quality_score: overallScore,
          citation_count: citationCount,
          is_research_grounded: researchResults.allCitations.length > 0,
          estimated_duration_minutes: Math.round(validatedSlides.length * 1.5),
        })
        .eq('id', slideRecordId);

      if (saveError) {
        console.error('[Main] Save error:', saveError);
        throw saveError;
      }

      const duration = Date.now() - startTime;
      console.log(`[Main] Generation complete in ${duration}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          slideId: slideRecordId,
          slideCount: validatedSlides.length,
          qualityScore: overallScore,
          citationCount,
          durationMs: duration,
          phases: {
            research: researchResults.allCitations.length > 0 ? 'grounded' : 'fallback',
            visuals: visualResults.diagrams.length + visualResults.images.length,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (agentError) {
      console.error('[Main] Agent error:', agentError);
      
      // Mark as failed
      await supabase
        .from('lecture_slides')
        .update({
          status: 'failed',
          error_message: agentError instanceof Error ? agentError.message : 'Unknown agent error',
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
