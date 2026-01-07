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

    const systemPrompt = `You are a friendly, expert teaching assistant helping an instructor curate the perfect YouTube videos for their course. Speak conversationally as a helpful colleague - never expose technical details, scores, or internal reasoning.

Your communication style:
- Be warm and supportive, like a knowledgeable peer
- Give concrete, actionable advice
- Explain pedagogical reasoning in simple terms
- When suggesting searches, explain WHY in plain language (e.g., "I'd recommend searching for 'X' because it tends to surface more practical, hands-on content")
- Never mention match scores, query strings, or internal system details

Current context you can reference (but don't expose directly):
- Learning objective: "${lo.text}"
- Bloom's level: ${lo.bloom_level || 'understand'} (use this to inform your advice)
- Target duration: ~${lo.expected_duration_minutes || 15} minutes
- Module: ${lo.modules?.title || 'General'}

${contentMatches?.length ? `There are ${contentMatches.length} videos currently matched - ${contentMatches.filter(m => m.status === 'approved' || m.status === 'auto_approved').length} approved, ${contentMatches.filter(m => m.status === 'pending').length} pending review.` : 'No videos have been found yet.'}

When responding:
1. If asked about current matches, give your honest opinion on whether they fit well
2. If videos seem off-topic, suggest better search approaches
3. For finding alternatives, explain what TYPE of video would work better (e.g., "For an 'analyze' level objective, look for case study breakdowns rather than basic tutorials")
4. Be honest if the current options aren't great - suggest what to look for instead

If you want to suggest a specific search, include it in this format (I'll detect it and offer a search button):
[ACTION:SEARCH:your suggested query here]

Example good responses:
- "The current top match looks solid for helping students understand the concept. However, I'd suggest also looking for a worked example video to reinforce application. Try searching for 'pitch deck walkthrough real startup' to find practical demonstrations."
- "Hmm, these results seem a bit too general for your specific objective. Since you're targeting the 'analyze' level, let's look for videos that break down real examples. [ACTION:SEARCH:startup pitch analysis breakdown]"`;

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
