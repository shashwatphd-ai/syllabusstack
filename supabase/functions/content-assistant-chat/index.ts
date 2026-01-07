import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create user client for auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { learning_objective_id, message, conversation_history = [] } = await req.json();

    if (!learning_objective_id || !message) {
      return new Response(JSON.stringify({ error: 'learning_objective_id and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch learning objective details
    const { data: lo, error: loError } = await supabase
      .from('learning_objectives')
      .select('*, modules(title, description)')
      .eq('id', learning_objective_id)
      .single();

    if (loError || !lo) {
      return new Response(JSON.stringify({ error: 'Learning objective not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch current content matches
    const { data: contentMatches } = await supabase
      .from('content_matches')
      .select('*, content(*)')
      .eq('learning_objective_id', learning_objective_id)
      .order('match_score', { ascending: false });

    // Fetch search strategies
    const { data: strategies } = await supabase
      .from('content_search_strategies')
      .select('*')
      .eq('learning_objective_id', learning_objective_id)
      .order('priority');

    // Build context for AI
    const contentContext = contentMatches?.length 
      ? contentMatches.map(m => 
          `- "${m.content?.title}" (Score: ${m.match_score}, Status: ${m.status})${m.ai_reasoning ? ` - AI: ${m.ai_reasoning}` : ''}`
        ).join('\n')
      : 'No content matched yet.';

    const strategyContext = strategies?.length
      ? strategies.map(s => `- Query: "${s.query}" (${s.expected_video_type})`).join('\n')
      : 'No search strategies generated yet.';

    const systemPrompt = `You are a proactive teaching assistant that TAKES ACTION. When an instructor asks you to find, search, or get videos - you IMMEDIATELY execute a search. Don't just describe what you would do - DO IT.

CRITICAL RULES:
1. If the user says "find", "search", "get", "show me", or asks for videos → ALWAYS include [ACTION:SEARCH:query] in your response
2. Keep explanations SHORT (1-2 sentences max)
3. NEVER ask what kind of video they want - make a smart decision and search
4. NEVER just describe what you could search for - actually trigger the search

Context (hidden from user):
- Objective: "${lo.text}"
- Bloom level: ${lo.bloom_level || 'understand'}
- Module: ${lo.modules?.title || 'General'}
- Current videos: ${contentMatches?.length || 0} matched

RESPONSE FORMAT - Always be brief and action-oriented:
- If user wants to find videos: "Searching for [type of content]..." + [ACTION:SEARCH:specific query]
- If user asks about current matches: Give 1-2 sentence opinion
- If user wants alternatives: Brief reason + [ACTION:SEARCH:query]

SEARCH QUERY TIPS (for ${lo.bloom_level || 'understand'} level):
- For "remember/understand": tutorials, explanations, overviews
- For "apply": demonstrations, how-to, step-by-step, examples
- For "analyze": case studies, breakdowns, comparisons
- For "evaluate/create": critiques, frameworks, advanced techniques

Example responses:
User: "Find me something more practical"
→ "Searching for hands-on demonstrations... [ACTION:SEARCH:${lo.core_concept || 'entrepreneurship'} practical demonstration real example]"

User: "ok find a video"
→ "On it! [ACTION:SEARCH:${lo.core_concept || 'networking'} entrepreneur hands-on guide]"

User: "Show me university content"
→ "Searching university channels... [ACTION:SEARCH:${lo.core_concept || 'business'} lecture university course]"`;

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.map((m: any) => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    console.log(`Content assistant chat for LO: ${learning_objective_id}`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error('No response from AI');
    }

    // Check for action commands in the response
    const searchActionMatch = assistantMessage.match(/\[ACTION:SEARCH:(.+?)\]/);
    const suggestedSearch = searchActionMatch ? searchActionMatch[1].trim() : null;

    // Clean the response of action tags for display
    const cleanedMessage = assistantMessage.replace(/\[ACTION:SEARCH:.+?\]/g, '').trim();

    // Update conversation in database
    const newMessages = [
      ...conversation_history,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: cleanedMessage, timestamp: new Date().toISOString() }
    ];

    // Upsert conversation
    const { data: existingChat } = await supabase
      .from('content_assistant_chats')
      .select('id')
      .eq('learning_objective_id', learning_objective_id)
      .eq('user_id', user.id)
      .single();

    if (existingChat) {
      await supabase
        .from('content_assistant_chats')
        .update({ messages: newMessages, updated_at: new Date().toISOString() })
        .eq('id', existingChat.id);
    } else {
      await supabase
        .from('content_assistant_chats')
        .insert({
          learning_objective_id,
          user_id: user.id,
          messages: newMessages
        });
    }

    return new Response(JSON.stringify({
      message: cleanedMessage,
      suggested_search: suggestedSearch,
      conversation_id: existingChat?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in content-assistant-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
