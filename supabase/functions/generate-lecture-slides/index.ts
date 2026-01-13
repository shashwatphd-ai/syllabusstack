import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Slide {
  order: number;
  type: 'title' | 'objectives' | 'prerequisites' | 'concept' | 'example' | 
        'worked_problem' | 'misconception' | 'summary' | 'discussion' | 'assessment';
  title: string;
  content: string[];
  speaker_notes: string;
  visual_suggestion: string;
}

interface GenerateSlidesRequest {
  teaching_unit_id: string;
  style?: 'standard' | 'minimal' | 'detailed' | 'interactive';
  include_speaker_notes?: boolean;
  regenerate?: boolean;
}

interface TeachingUnit {
  id: string;
  learning_objective_id: string;
  sequence_order: number;
  title: string;
  description: string | null;
  what_to_teach: string;
  why_this_matters: string | null;
  how_to_teach: string | null;
  common_misconceptions: string[] | null;
  prerequisites: string[] | null;
  enables: string[] | null;
  target_video_type: string;
  target_duration_minutes: number;
  search_queries: string[];
  required_concepts: string[] | null;
  avoid_terms: string[] | null;
}

interface LearningObjective {
  id: string;
  text: string;
  bloom_level: string | null;
  core_concept: string | null;
  instructor_course_id: string;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  detected_domain: string | null;
}

const SYSTEM_PROMPT = `You are an expert instructional designer creating lecture slides that can teach autonomously through text-to-speech narration.

CRITICAL DESIGN PRINCIPLES:
1. Each slide teaches ONE focused idea - avoid cognitive overload
2. Content flows from the teaching unit's pedagogical structure - respect the curriculum design
3. Speaker notes are COMPLETE SCRIPTS for text-to-speech narration - write as if speaking directly to a student
4. Visual suggestions help students understand abstract concepts - be specific about diagrams, charts, or images

SLIDE TYPES (use appropriately based on content):
- "title": Opening slide with unit title and learning focus
- "objectives": What students will learn (from what_to_teach)
- "prerequisites": Quick review of prior knowledge (from prerequisites)
- "concept": Core conceptual content (use multiple slides for complex topics)
- "example": Concrete example or illustration
- "worked_problem": Step-by-step problem solving (for worked_example video type)
- "misconception": Address common misunderstandings (from common_misconceptions)
- "summary": Key takeaways
- "discussion": Reflection questions for deeper thinking
- "assessment": Quick self-check question

SPEAKER NOTES RULES:
- Write as if speaking directly to a student in a conversational tone
- Use complete sentences with natural speech patterns
- 30-60 seconds of speaking per slide (approximately 75-150 words)
- Reference visual elements: "As you can see in the diagram..." or "Notice how..."
- Include transitions: "Now let's look at..." or "Building on this..."
- Add emphasis where appropriate: "This is really important because..."

SLIDE CONTENT RULES:
- Maximum 5-7 bullet points per slide
- Each bullet should be concise (under 15 words)
- Use parallel structure in lists
- Include specific examples when possible

OUTPUT FORMAT: Return valid JSON only, no markdown or explanations outside the JSON.`;

function buildUserPrompt(
  unit: TeachingUnit, 
  lo: LearningObjective, 
  module: Module | null, 
  course: Course,
  style: string
): string {
  const targetSlideCount = Math.ceil(unit.target_duration_minutes * 0.8);
  const maxSlideCount = Math.ceil(unit.target_duration_minutes * 1.2);

  return `Generate lecture slides for this teaching unit.

TEACHING UNIT:
Title: ${unit.title}
What to Teach: ${unit.what_to_teach}
${unit.why_this_matters ? `Why This Matters: ${unit.why_this_matters}` : ''}
${unit.how_to_teach ? `How to Teach: ${unit.how_to_teach}` : ''}
Target Duration: ${unit.target_duration_minutes} minutes
Target Video Type: ${unit.target_video_type}

${unit.prerequisites?.length ? `Prerequisites (review these briefly): ${unit.prerequisites.join(', ')}` : ''}
${unit.enables?.length ? `Enables (foreshadow these): ${unit.enables.join(', ')}` : ''}
${unit.common_misconceptions?.length ? `Common Misconceptions to Address:\n- ${unit.common_misconceptions.join('\n- ')}` : ''}
${unit.required_concepts?.length ? `Required Concepts to Cover: ${unit.required_concepts.join(', ')}` : ''}
${unit.avoid_terms?.length ? `Terms to Avoid: ${unit.avoid_terms.join(', ')}` : ''}

PARENT LEARNING OBJECTIVE:
"${lo.text}"
${lo.bloom_level ? `Bloom's Level: ${lo.bloom_level}` : ''}
${lo.core_concept ? `Core Concept: ${lo.core_concept}` : ''}

${module ? `MODULE CONTEXT:
"${module.title}"${module.description ? `: ${module.description}` : ''}` : ''}

COURSE CONTEXT:
"${course.title}"
${course.detected_domain ? `Domain: ${course.detected_domain}` : ''}

SLIDE STYLE: ${style}
${style === 'minimal' ? 'Focus on key points only, fewer words per slide.' : ''}
${style === 'detailed' ? 'Include more depth and explanation.' : ''}
${style === 'interactive' ? 'Include discussion prompts and self-check questions.' : ''}

REQUIREMENTS:
- Generate ${targetSlideCount} to ${maxSlideCount} slides
- Start with a title slide, end with a summary
- Include at least one slide addressing misconceptions if any are listed
- Adapt slide types to the target_video_type (e.g., more worked_problem slides for "worked_example")
- Speaker notes must be complete narration scripts suitable for text-to-speech

RESPONSE FORMAT (JSON only):
{
  "slides": [
    {
      "order": 1,
      "type": "title",
      "title": "Slide title",
      "content": ["Main point 1", "Main point 2"],
      "speaker_notes": "Complete narration script for this slide...",
      "visual_suggestion": "Description of suggested visual or diagram"
    }
  ],
  "total_slides": <number>,
  "estimated_duration_minutes": <number>
}`;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<{
  slides: Slide[];
  total_slides: number;
  estimated_duration_minutes: number;
}> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  console.log('[generate-lecture-slides] Calling Lovable AI Gateway...');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5.2', // Best reasoning model for pedagogical content
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[generate-lecture-slides] AI Gateway error:', error);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('AI credits exhausted. Please add funds to your workspace.');
    }
    
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const responseText = await response.text();
  
  if (!responseText || responseText.trim() === '') {
    console.error('[generate-lecture-slides] Empty response from AI gateway');
    throw new Error('Empty response from AI gateway. Please try again.');
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error('[generate-lecture-slides] Failed to parse gateway response:', responseText.substring(0, 500));
    throw new Error('Invalid JSON from AI gateway');
  }

  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in AI response');
  }

  console.log('[generate-lecture-slides] Raw AI response length:', content.length);
  
  // Extract JSON from response (may be wrapped in markdown)
  let jsonContent = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1].trim();
  }
  
  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    console.error('[generate-lecture-slides] Failed to parse AI response:', content.substring(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header for user context
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { 
      teaching_unit_id, 
      style = 'standard',
      include_speaker_notes = true,
      regenerate = false 
    } = await req.json() as GenerateSlidesRequest;

    if (!teaching_unit_id) {
      throw new Error('teaching_unit_id is required');
    }

    console.log('[generate-lecture-slides] Generating slides for unit:', teaching_unit_id);

    // Fetch teaching unit with full context
    const { data: unit, error: unitError } = await supabase
      .from('teaching_units')
      .select(`
        *,
        learning_objective:learning_objective_id(
          id, text, bloom_level, core_concept, instructor_course_id,
          module:module_id(id, title, description),
          instructor_course:instructor_course_id(id, title, description, detected_domain)
        )
      `)
      .eq('id', teaching_unit_id)
      .single();

    if (unitError || !unit) {
      console.error('[generate-lecture-slides] Error fetching teaching unit:', unitError);
      throw new Error(`Teaching unit not found: ${teaching_unit_id}`);
    }

    const lo = unit.learning_objective as LearningObjective & { 
      module: Module | null;
      instructor_course: Course;
    };
    
    if (!lo?.instructor_course) {
      throw new Error('Teaching unit must belong to a course');
    }

    // Check for existing slides
    if (!regenerate) {
      const { data: existingSlides } = await supabase
        .from('lecture_slides')
        .select('id, status')
        .eq('teaching_unit_id', teaching_unit_id)
        .maybeSingle();

      if (existingSlides && existingSlides.status !== 'failed') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Slides already exist',
            lecture_slide_id: existingSlides.id,
            already_exists: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for existing slide record first
    const { data: existingRecord } = await supabase
      .from('lecture_slides')
      .select('id')
      .eq('teaching_unit_id', teaching_unit_id)
      .maybeSingle();

    let slideRecord;
    
    if (existingRecord) {
      // Update existing record
      const { data: updated, error: updateErr } = await supabase
        .from('lecture_slides')
        .update({
          title: unit.title,
          status: 'generating',
          slide_style: style,
          error_message: null,
        })
        .eq('id', existingRecord.id)
        .select()
        .single();
        
      if (updateErr) {
        console.error('[generate-lecture-slides] Error updating slide record:', updateErr);
        throw updateErr;
      }
      slideRecord = updated;
    } else {
      // Create new record
      const { data: inserted, error: insertErr } = await supabase
        .from('lecture_slides')
        .insert({
          teaching_unit_id,
          learning_objective_id: lo.id,
          instructor_course_id: lo.instructor_course.id,
          title: unit.title,
          status: 'generating',
          slide_style: style,
          created_by: userId,
        })
        .select()
        .single();
        
      if (insertErr) {
        console.error('[generate-lecture-slides] Error creating slide record:', insertErr);
        throw insertErr;
      }
      slideRecord = inserted;
    }

    // Build prompts and call AI
    const userPrompt = buildUserPrompt(
      unit as TeachingUnit,
      lo,
      lo.module,
      lo.instructor_course,
      style
    );

    let result;
    try {
      result = await callAI(SYSTEM_PROMPT, userPrompt);
    } catch (aiError) {
      // Update status to failed
      await supabase
        .from('lecture_slides')
        .update({ 
          status: 'failed', 
          error_message: aiError instanceof Error ? aiError.message : 'Unknown error' 
        })
        .eq('id', slideRecord.id);
      throw aiError;
    }

    console.log('[generate-lecture-slides] Generated', result.slides?.length || 0, 'slides');

    // Validate slides
    if (!result.slides || result.slides.length === 0) {
      await supabase
        .from('lecture_slides')
        .update({ status: 'failed', error_message: 'AI returned no slides' })
        .eq('id', slideRecord.id);
      throw new Error('AI returned no slides');
    }

    // Normalize slides
    const validSlideTypes = ['title', 'objectives', 'prerequisites', 'concept', 'example', 
      'worked_problem', 'misconception', 'summary', 'discussion', 'assessment'];
    
    const normalizedSlides = result.slides.map((slide, index) => ({
      order: slide.order || index + 1,
      type: validSlideTypes.includes(slide.type) ? slide.type : 'concept',
      title: slide.title || `Slide ${index + 1}`,
      content: Array.isArray(slide.content) ? slide.content : [slide.content || ''],
      speaker_notes: include_speaker_notes ? (slide.speaker_notes || '') : '',
      visual_suggestion: slide.visual_suggestion || '',
    }));

    // Update slide record with content
    const { error: updateError } = await supabase
      .from('lecture_slides')
      .update({
        slides: normalizedSlides,
        total_slides: normalizedSlides.length,
        estimated_duration_minutes: result.estimated_duration_minutes || unit.target_duration_minutes,
        generation_model: 'openai/gpt-5.2',
        generation_context: {
          teaching_unit_title: unit.title,
          learning_objective_text: lo.text,
          style,
        },
        status: 'ready',
        error_message: null,
      })
      .eq('id', slideRecord.id);

    if (updateError) {
      console.error('[generate-lecture-slides] Error updating slides:', updateError);
      throw updateError;
    }

    console.log('[generate-lecture-slides] Successfully saved', normalizedSlides.length, 'slides');

    return new Response(
      JSON.stringify({
        success: true,
        lecture_slide_id: slideRecord.id,
        slides: normalizedSlides,
        total_slides: normalizedSlides.length,
        estimated_duration_minutes: result.estimated_duration_minutes || unit.target_duration_minutes,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('[generate-lecture-slides] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
