import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Cloud API configuration
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GenerateCurriculumRequest {
  career_match_id?: string;
  dream_job_id?: string;
  customizations?: {
    hours_per_week?: number;
    learning_style?: 'visual' | 'reading' | 'hands_on';
    priority_skills?: string[];
    exclude_topics?: string[];
  };
}

interface CurriculumSubject {
  title: string;
  description: string;
  estimated_hours: number;
  modules: {
    title: string;
    description: string;
    estimated_hours: number;
    learning_objectives: {
      text: string;
      bloom_level: string;
      estimated_minutes: number;
    }[];
  }[];
  skills_covered: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;
    const body: GenerateCurriculumRequest = await req.json();
    const { career_match_id, dream_job_id, customizations = {} } = body;

    console.log(`Generating curriculum for user: ${userId}, career_match_id: ${career_match_id}, dream_job_id: ${dream_job_id}`);

    // Gather context - either from career_match or dream_job
    let targetOccupation: string;
    let skillGaps: Array<{ skill: string; gap: number }> = [];
    let skillProfile: Record<string, unknown> | null = null;
    let occupationDetails: Record<string, unknown> | null = null;

    if (career_match_id) {
      // Get career match details
      const { data: careerMatch, error: cmError } = await supabase
        .from('career_matches')
        .select('*')
        .eq('id', career_match_id)
        .eq('user_id', userId)
        .single();

      if (cmError || !careerMatch) {
        return new Response(JSON.stringify({ error: 'Career match not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      targetOccupation = careerMatch.occupation_title;
      skillGaps = careerMatch.skill_gaps || [];
      
      // Get skill profile
      if (careerMatch.skill_profile_id) {
        const { data: profile } = await supabase
          .from('skill_profiles')
          .select('*')
          .eq('id', careerMatch.skill_profile_id)
          .single();
        skillProfile = profile;
      }

      // Get O*NET occupation details
      const { data: occupation } = await supabase
        .from('onet_occupations')
        .select('*')
        .eq('soc_code', careerMatch.onet_soc_code)
        .single();
      occupationDetails = occupation;

    } else if (dream_job_id) {
      // Get dream job details
      const { data: dreamJob, error: djError } = await supabase
        .from('dream_jobs')
        .select('*')
        .eq('id', dream_job_id)
        .eq('user_id', userId)
        .single();

      if (djError || !dreamJob) {
        return new Response(JSON.stringify({ error: 'Dream job not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      targetOccupation = dreamJob.title;

      // Get gap analysis if exists
      const { data: gapAnalysis } = await supabase
        .from('gap_analyses')
        .select('*')
        .eq('dream_job_id', dream_job_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gapAnalysis?.critical_gaps) {
        skillGaps = (gapAnalysis.critical_gaps as Array<{ skill: string }>).map(g => ({
          skill: g.skill || (typeof g === 'string' ? g : ''),
          gap: 50,
        }));
      }
    } else {
      return new Response(JSON.stringify({ error: 'Either career_match_id or dream_job_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build AI prompt
    const hoursPerWeek = customizations.hours_per_week || 10;
    const learningStyle = customizations.learning_style || 'hands_on';
    const prioritySkills = customizations.priority_skills || [];
    const excludeTopics = customizations.exclude_topics || [];

    const systemPrompt = `You are an expert curriculum designer specializing in career transition and skill development.
You use backward design principles (Understanding by Design) and Bloom's taxonomy.

Generate a comprehensive learning curriculum to help someone become job-ready for the target role.
The curriculum should be practical, structured, and achievable within the estimated timeframe.

CRITICAL: Return ONLY valid JSON with no additional text or markdown formatting.`;

    const userPrompt = `Create a structured curriculum for someone aspiring to become a: ${targetOccupation}

LEARNER CONTEXT:
${skillProfile ? `- Holland Code: ${(skillProfile as Record<string, unknown>).holland_code || 'Unknown'}` : ''}
- Skill Gaps to Address: ${skillGaps.length > 0 ? skillGaps.map(g => g.skill).join(', ') : 'General skill development'}
${prioritySkills.length > 0 ? `- Priority Focus Areas: ${prioritySkills.join(', ')}` : ''}
${excludeTopics.length > 0 ? `- Topics to Exclude: ${excludeTopics.join(', ')}` : ''}

LEARNING PREFERENCES:
- Available time: ${hoursPerWeek} hours per week
- Learning style preference: ${learningStyle}

OCCUPATION CONTEXT:
${occupationDetails ? `
- Required Skills: ${JSON.stringify((occupationDetails as Record<string, unknown>).required_skills || [])}
- Required Knowledge: ${JSON.stringify((occupationDetails as Record<string, unknown>).required_knowledge || [])}
` : '- Focus on industry-standard competencies'}

Generate a curriculum with 3-6 subjects, each containing 2-5 modules, each with 2-6 learning objectives.

Return JSON in this exact format:
{
  "subjects": [
    {
      "title": "Subject Title",
      "description": "Brief subject description",
      "estimated_hours": 20,
      "skills_covered": ["skill1", "skill2"],
      "modules": [
        {
          "title": "Module Title",
          "description": "Module description",
          "estimated_hours": 5,
          "learning_objectives": [
            {
              "text": "By the end of this module, learners will be able to...",
              "bloom_level": "apply",
              "estimated_minutes": 45
            }
          ]
        }
      ]
    }
  ],
  "estimated_total_weeks": 12,
  "curriculum_summary": "Brief summary of what this curriculum covers"
}`;

    if (!googleApiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Google Cloud API
    const url = `${GOOGLE_API_BASE}/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`;
    const aiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.7,
        },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Google Cloud API error:', aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted, please add funds' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('Failed to generate curriculum from AI');
    }

    const aiData = await aiResponse.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No content returned from AI');
    }

    // Parse JSON from AI response
    let curriculumData: {
      subjects: CurriculumSubject[];
      estimated_total_weeks: number;
      curriculum_summary: string;
    };

    try {
      // Clean up potential markdown formatting
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      curriculumData = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse curriculum structure');
    }

    // Calculate totals
    const totalModules = curriculumData.subjects.reduce((sum, s) => sum + s.modules.length, 0);
    const totalLearningObjectives = curriculumData.subjects.reduce(
      (sum, s) => sum + s.modules.reduce((mSum, m) => mSum + m.learning_objectives.length, 0),
      0
    );

    // Save to database
    const { data: curriculum, error: saveError } = await supabase
      .from('generated_curricula')
      .insert({
        user_id: userId,
        career_match_id: career_match_id || null,
        target_occupation: targetOccupation,
        curriculum_structure: curriculumData,
        estimated_weeks: curriculumData.estimated_total_weeks,
        total_subjects: curriculumData.subjects.length,
        total_modules: totalModules,
        total_learning_objectives: totalLearningObjectives,
        generation_model: 'google/gemini-2.5-flash',
        status: 'generated',
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save curriculum:', saveError);
      throw saveError;
    }

    console.log(`Generated curriculum ${curriculum.id} with ${curriculumData.subjects.length} subjects`);

    return new Response(JSON.stringify({
      success: true,
      curriculum_id: curriculum.id,
      title: targetOccupation,
      summary: curriculumData.curriculum_summary,
      estimated_weeks: curriculumData.estimated_total_weeks,
      subjects: curriculumData.subjects.map(s => ({
        title: s.title,
        description: s.description,
        estimated_hours: s.estimated_hours,
        modules_count: s.modules.length,
        skills_covered: s.skills_covered,
      })),
      total_modules: totalModules,
      total_learning_objectives: totalLearningObjectives,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in generate-curriculum:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate curriculum';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
