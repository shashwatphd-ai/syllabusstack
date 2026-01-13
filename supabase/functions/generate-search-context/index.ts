import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTIC SEARCH CONTEXT GENERATOR
 * 
 * This function uses AI to understand WHAT to search for based on:
 * 1. The learning objective in context of the course domain
 * 2. What students need to learn (not just keywords)
 * 3. Domain-specific terminology and examples
 * 
 * Returns context-aware search queries that go beyond simple keyword extraction.
 */

interface SearchContextRequest {
  learning_objective: {
    id: string;
    text: string;
    core_concept?: string;
    bloom_level?: string;
    action_verb?: string;
    expected_duration_minutes?: number;
  };
  module?: {
    title: string;
    description?: string;
  };
  course?: {
    title: string;
    description?: string;
    code?: string;
    detected_domain?: string;
  };
}

interface SearchContextResponse {
  queries: string[];
  domain_context: string;
  key_concepts: string[];
  search_strategy: string;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { learning_objective, module, course } = await req.json() as SearchContextRequest;

    if (!learning_objective?.text) {
      throw new Error("learning_objective.text is required");
    }

    console.log(`[SEARCH CONTEXT] Generating context for LO: "${learning_objective.text.substring(0, 50)}..."`);
    console.log(`[SEARCH CONTEXT] Course: ${course?.title || 'Unknown'}, Module: ${module?.title || 'Unknown'}`);

    const systemPrompt = `You are an expert curriculum designer and educational content curator. Your task is to analyze a learning objective and generate highly targeted search queries that will find the BEST educational videos.

CRITICAL INSTRUCTIONS:
1. Understand the DOMAIN context (e.g., "Strategic Management" means business/MBA content, not education theory)
2. Infer what students should be able to DO after watching (based on Bloom's taxonomy)
3. Generate queries that will find practical, relevant educational content
4. AVOID generic terms that could match unrelated content
5. Consider what types of videos would work best (lectures, case studies, tutorials, etc.)

Return your analysis as a JSON object with these fields:
- queries: Array of 4-6 specific search queries (ordered by expected quality)
- domain_context: One sentence describing the academic/professional domain
- key_concepts: Array of 3-5 core concepts students must understand
- search_strategy: Brief description of what type of videos to prioritize
- reasoning: Explain your query generation logic`;

    const userPrompt = `Analyze this learning objective and generate targeted YouTube search queries:

COURSE: ${course?.title || 'Not specified'}
${course?.code ? `COURSE CODE: ${course.code}` : ''}
${course?.description ? `COURSE DESCRIPTION: ${course.description}` : ''}
${course?.detected_domain ? `DETECTED DOMAIN: ${course.detected_domain}` : ''}

MODULE: ${module?.title || 'Not specified'}
${module?.description ? `MODULE DESCRIPTION: ${module.description}` : ''}

LEARNING OBJECTIVE: ${learning_objective.text}
${learning_objective.core_concept ? `CORE CONCEPT: ${learning_objective.core_concept}` : ''}
${learning_objective.bloom_level ? `BLOOM'S LEVEL: ${learning_objective.bloom_level}` : ''}
${learning_objective.action_verb ? `ACTION VERB: ${learning_objective.action_verb}` : ''}
${learning_objective.expected_duration_minutes ? `EXPECTED DURATION: ${learning_objective.expected_duration_minutes} minutes` : ''}

Generate search queries that will find the most relevant educational videos for teaching this specific learning objective within the context of this course and module. Focus on the DOMAIN context - a strategic management course needs business strategy content, not general education videos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_search_context",
              description: "Generate targeted search queries for educational content",
              parameters: {
                type: "object",
                properties: {
                  queries: {
                    type: "array",
                    items: { type: "string" },
                    description: "4-6 specific search queries ordered by expected quality"
                  },
                  domain_context: {
                    type: "string",
                    description: "One sentence describing the academic/professional domain"
                  },
                  key_concepts: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 core concepts students must understand"
                  },
                  search_strategy: {
                    type: "string",
                    description: "Brief description of what type of videos to prioritize"
                  },
                  reasoning: {
                    type: "string",
                    description: "Explanation of query generation logic"
                  }
                },
                required: ["queries", "domain_context", "key_concepts", "search_strategy", "reasoning"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_search_context" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SEARCH CONTEXT] AI API error: ${response.status}`, errorText);
      
      // Fallback: generate basic queries without AI
      const fallbackQueries = generateFallbackQueries(learning_objective, module, course);
      return new Response(
        JSON.stringify({
          queries: fallbackQueries,
          domain_context: course?.title || "General",
          key_concepts: [learning_objective.core_concept || learning_objective.text.split(' ').slice(0, 3).join(' ')],
          search_strategy: "Using keyword-based fallback",
          reasoning: "AI unavailable, using fallback query generation",
          fallback: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No tool call response from AI");
    }

    const result: SearchContextResponse = JSON.parse(toolCall.function.arguments);

    console.log(`[SEARCH CONTEXT] Generated ${result.queries.length} queries:`);
    result.queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
    console.log(`[SEARCH CONTEXT] Domain: ${result.domain_context}`);
    console.log(`[SEARCH CONTEXT] Strategy: ${result.search_strategy}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SEARCH CONTEXT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Fallback query generation when AI is unavailable
 */
function generateFallbackQueries(
  lo: SearchContextRequest['learning_objective'],
  module?: SearchContextRequest['module'],
  course?: SearchContextRequest['course']
): string[] {
  const queries: string[] = [];
  const courseContext = course?.title?.toLowerCase() || '';
  const moduleContext = module?.title?.toLowerCase() || '';
  const loText = lo.text.toLowerCase();
  
  // Extract meaningful words (filter out common words)
  const stopWords = new Set(['the', 'and', 'or', 'to', 'a', 'an', 'of', 'in', 'for', 'on', 'with', 'how', 'what', 'why', 'understand', 'explain', 'describe', 'analyze', 'evaluate', 'apply']);
  const loWords = loText.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  
  // Query 1: Core concept with course context
  if (lo.core_concept) {
    queries.push(`${lo.core_concept} ${courseContext.split(' ').slice(0, 2).join(' ')} tutorial`);
  }
  
  // Query 2: Module context with key words
  if (module?.title) {
    queries.push(`${module.title} ${loWords.slice(0, 2).join(' ')} explained`);
  }
  
  // Query 3: Action-based query
  if (lo.action_verb) {
    queries.push(`${lo.action_verb} ${loWords.slice(0, 3).join(' ')}`);
  }
  
  // Query 4: Generic educational query
  queries.push(`${loWords.slice(0, 4).join(' ')} lecture`);
  
  // Query 5: Course-specific
  if (course?.title) {
    queries.push(`${course.title} ${loWords[0] || ''} introduction`);
  }
  
  return queries.filter(q => q.trim().length > 5);
}
