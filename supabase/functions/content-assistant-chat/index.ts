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

    const systemPrompt = `You are an expert educational content curator assistant helping an instructor find the perfect YouTube videos for their course.

You have deep knowledge of:
- Bloom's Taxonomy and how different video types support different cognitive levels
- YouTube content ecosystem and quality indicators
- Pedagogical best practices for video-based learning

Your current context:
LEARNING OBJECTIVE: "${lo.text}"
BLOOM'S LEVEL: ${lo.bloom_level || 'understand'}
CORE CONCEPT: ${lo.core_concept || 'the topic'}
DOMAIN: ${lo.domain || 'general'}
MODULE: ${lo.modules?.title || 'Unassigned'}
TARGET DURATION: ~${lo.expected_duration_minutes || 15} minutes

CURRENT SEARCH STRATEGIES:
${strategyContext}

CURRENT CONTENT MATCHES:
${contentContext}

When responding:
1. Be helpful and specific - suggest exact search queries when relevant
2. Explain your reasoning in educational terms
3. If asked to find alternatives, suggest new search strategies
4. Be honest about limitations of current matches
5. You can recommend actions like "search for X" or "consider rejecting Y because..."

IMPORTANT: If the instructor wants you to search for new content, include this in your response:
[ACTION:SEARCH:your suggested query here]

This will trigger a new search automatically.`;

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
