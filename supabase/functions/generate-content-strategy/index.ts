import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bloom's Taxonomy descriptions for AI context
const BLOOM_DESCRIPTIONS: Record<string, { action: string; videoTypes: string; focus: string }> = {
  remember: {
    action: "recall facts, terms, and basic concepts",
    videoTypes: "introductory lectures, definitions, overviews, concept explanations",
    focus: "clear explanations of what things ARE, not how to use them"
  },
  understand: {
    action: "explain ideas, concepts, and interpret meaning",
    videoTypes: "explanations with examples, analogies, visualizations, comparisons",
    focus: "WHY things work, making connections, building mental models"
  },
  apply: {
    action: "use information in new situations, solve problems",
    videoTypes: "step-by-step tutorials, worked examples, practice problems, how-to guides",
    focus: "HOW to do something, practical demonstrations, hands-on walkthroughs"
  },
  analyze: {
    action: "draw connections, break down information, identify patterns",
    videoTypes: "deep dives, case studies, comparisons, breakdowns, critical analysis",
    focus: "EXAMINING components and relationships, finding patterns"
  },
  evaluate: {
    action: "justify decisions, make judgments, critique",
    videoTypes: "debates, critiques, pros/cons analysis, decision frameworks, expert opinions",
    focus: "JUDGING quality, making decisions, defending positions"
  },
  create: {
    action: "produce new or original work, design solutions",
    videoTypes: "project walkthroughs, design processes, building tutorials, creative showcases",
    focus: "BUILDING something new, combining ideas, original synthesis"
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { learning_objective } = await req.json();

    if (!learning_objective) {
      return new Response(JSON.stringify({ error: 'learning_objective is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      id: loId,
      text: loText,
      bloom_level: bloomLevel,
      core_concept: coreConcept,
      domain,
      action_verb: actionVerb,
      search_keywords: searchKeywords,
      expected_duration_minutes: expectedDuration,
    } = learning_objective;

    // Phase 5: Enhanced module and course context for better search relevance
    let moduleContext = "";
    let courseContext = "";
    
    if (learning_objective.module_id) {
      const { data: module } = await supabase
        .from('modules')
        .select('title, description, instructor_course_id')
        .eq('id', learning_objective.module_id)
        .single();
      
      if (module) {
        moduleContext = `MODULE: "${module.title}"${module.description ? `\nModule Description: ${module.description}` : ''}`;
        
        // Also fetch course context
        if (module.instructor_course_id) {
          const { data: course } = await supabase
            .from('instructor_courses')
            .select('title, description')
            .eq('id', module.instructor_course_id)
            .single();
          
          if (course) {
            courseContext = `COURSE: "${course.title}"${course.description ? `\nCourse Description: ${course.description}` : ''}`;
          }
        }
      }
    }

    const bloomInfo = BLOOM_DESCRIPTIONS[bloomLevel?.toLowerCase() || 'understand'];

    const systemPrompt = `You are an expert educational content curator specializing in finding YouTube videos that match specific learning objectives. You understand Bloom's Taxonomy deeply and know what types of videos help students achieve different cognitive levels.

Your goal is to generate optimal YouTube search queries that will find videos matching the pedagogical requirements of the learning objective.`;

    const userPrompt = `Generate YouTube search strategies for this learning objective. CRITICAL: Searches must be SPECIFIC to the module and course context - avoid generic queries.

${courseContext ? `${courseContext}\n` : ''}${moduleContext ? `${moduleContext}\n` : ''}

LEARNING OBJECTIVE: "${loText}"

BLOOM'S LEVEL: ${bloomLevel || 'understand'}
- At this level, students need to: ${bloomInfo.action}
- Best video types: ${bloomInfo.videoTypes}
- Focus should be on: ${bloomInfo.focus}

CORE CONCEPT: ${coreConcept || 'the main topic'}
DOMAIN: ${domain || 'general'}
ACTION VERB: ${actionVerb || 'understand'}
${searchKeywords?.length ? `KEYWORDS TO CONSIDER: ${searchKeywords.join(', ')}` : ''}
TARGET DURATION: ~${expectedDuration || 15} minutes

IMPORTANT GUIDELINES:
- All queries MUST relate specifically to the module topic "${moduleContext || 'this subject'}"
- Avoid overly generic queries like "entrepreneurship" or "business" - be specific!
- Include module-specific terminology in queries
- Consider what makes THIS module different from others in the course

Generate 6 diverse search strategies, prioritized by likely effectiveness. Consider:
1. Module-specific concept phrasing (e.g., for a "Pitch Deck" module, use "pitch deck" not just "presentation")
2. Adding "tutorial", "explained", "course" for educational content
3. Domain-specific terminology from the module
4. Content creator patterns (e.g., "crash course", "in 10 minutes")
5. Academic vs practical approaches for this specific topic

Return ONLY valid JSON in this exact format:
{
  "strategies": [
    {
      "query": "exact YouTube search query - must be module-specific",
      "rationale": "why this query will find content specific to this module",
      "expected_video_type": "lecture|tutorial|case study|animation|worked example|explanation|demonstration",
      "priority": 1
    }
  ]
}`;

    console.log('Calling AI for content strategy generation...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON from AI response
    let strategies;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      strategies = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Fallback to basic strategies if AI parsing fails
      strategies = {
        strategies: [
          { query: `${coreConcept} ${bloomLevel} tutorial`, rationale: "Basic concept + level query", expected_video_type: "tutorial", priority: 1 },
          { query: `${coreConcept} explained`, rationale: "Simple explanation query", expected_video_type: "explanation", priority: 2 },
          { query: `how to ${actionVerb} ${coreConcept}`, rationale: "Action-focused query", expected_video_type: "tutorial", priority: 3 },
          { query: `${coreConcept} course lecture`, rationale: "Academic content query", expected_video_type: "lecture", priority: 4 },
          { query: `${coreConcept} for beginners`, rationale: "Beginner-friendly content", expected_video_type: "explanation", priority: 5 },
          { query: `${domain} ${coreConcept} examples`, rationale: "Domain-specific examples", expected_video_type: "demonstration", priority: 6 },
        ]
      };
    }

    // Store strategies in database
    if (strategies.strategies && loId) {
      const strategiesToInsert = strategies.strategies.map((s: any) => ({
        learning_objective_id: loId,
        query: s.query,
        rationale: s.rationale,
        expected_video_type: s.expected_video_type,
        priority: s.priority,
      }));

      // Delete old strategies first
      await supabase
        .from('content_search_strategies')
        .delete()
        .eq('learning_objective_id', loId);

      const { error: insertError } = await supabase
        .from('content_search_strategies')
        .insert(strategiesToInsert);

      if (insertError) {
        console.error('Failed to store strategies:', insertError);
      }
    }

    console.log('Generated strategies:', strategies);

    return new Response(JSON.stringify(strategies), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in generate-content-strategy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
