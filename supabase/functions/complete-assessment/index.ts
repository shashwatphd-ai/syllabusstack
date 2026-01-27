import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno&deno-std=0.168.0";
import { extractSkillsFromLearningObjective, type LearningObjectiveData } from "../_shared/skill-extractor.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteAssessmentRequest {
  session_id: string;
}

// Verification threshold - 70% to pass
const PASSING_THRESHOLD = 70;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Server-side timestamp
    const completedAt = new Date().toISOString();

    // Authenticate user with their auth token (not service role)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's auth context for proper RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data, error: authError } = await supabase.auth.getClaims(token);

    if (authError || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const userId = data.claims.sub as string;
    const user = { id: userId };

    const body: CompleteAssessmentRequest = await req.json();
    const { session_id } = body;

    console.log(`Completing assessment session: ${session_id}`);

    // Fetch session with validation
    const { data: session, error: sessionError } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate session can be completed
    if (session.status === 'completed') {
      // Return existing results
      const { data: answers } = await supabase
        .from('assessment_answers')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true });

      return new Response(JSON.stringify({
        success: true,
        already_completed: true,
        session,
        answers: answers || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all answers for this session
    const { data: answers, error: answersError } = await supabase
      .from('assessment_answers')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (answersError) {
      console.error('Error fetching answers:', answersError);
      throw answersError;
    }

    // Calculate final score
    const questionsAnswered = answers?.length || 0;
    const questionsCorrect = answers?.filter(a => a.is_correct).length || 0;
    const totalScore = questionsAnswered > 0 
      ? (questionsCorrect / questionsAnswered) * 100 
      : 0;

    const passed = totalScore >= PASSING_THRESHOLD;

    // Calculate detailed metrics
    const totalTimeSeconds = answers?.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0) || 0;
    const avgTimePerQuestion = questionsAnswered > 0 ? totalTimeSeconds / questionsAnswered : 0;

    // Check for timing anomalies
    const timingFlags = answers?.filter(a => 
      a.evaluation_details?.timing_flags?.length > 0
    ).length || 0;

    // Update session with final results
    const { data: updatedSession, error: updateError } = await supabase
      .from('assessment_sessions')
      .update({
        status: 'completed',
        completed_at: completedAt,
        questions_answered: questionsAnswered,
        questions_correct: questionsCorrect,
        total_score: totalScore,
        passed,
      })
      .eq('id', session_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating session:', updateError);
      throw updateError;
    }

    // Update learning objective verification state and record verified skills if passed
    let verifiedSkillsRecorded: string[] = [];
    if (passed) {
      // Fetch the learning objective details for skill extraction
      const { data: learningObjective, error: loFetchError } = await supabase
        .from('learning_objectives')
        .select(`
          id,
          text,
          core_concept,
          action_verb,
          bloom_level,
          domain,
          specificity,
          search_keywords,
          course_id,
          module_id,
          courses!left(id, title),
          modules!left(id, title, instructor_course_id, instructor_courses(id, title))
        `)
        .eq('id', session.learning_objective_id)
        .eq('user_id', user.id)
        .single();

      if (loFetchError) {
        console.error('Error fetching learning objective:', loFetchError);
      }

      // Update verification state
      const { error: loError } = await supabase
        .from('learning_objectives')
        .update({
          verification_state: 'verified',
          updated_at: completedAt,
        })
        .eq('id', session.learning_objective_id)
        .eq('user_id', user.id);

      if (loError) {
        console.error('Error updating learning objective:', loError);
      } else {
        console.log(`Updated LO ${session.learning_objective_id} to verified`);
      }

      // Extract and record verified skills
      if (learningObjective) {
        try {
          // Extract skills from the learning objective
          const loData: LearningObjectiveData = {
            id: learningObjective.id,
            text: learningObjective.text,
            core_concept: learningObjective.core_concept,
            action_verb: learningObjective.action_verb,
            bloom_level: learningObjective.bloom_level,
            domain: learningObjective.domain,
            specificity: learningObjective.specificity,
            search_keywords: learningObjective.search_keywords,
          };

          const extractedSkills = extractSkillsFromLearningObjective(loData);
          console.log(`Extracted ${extractedSkills.length} skills from LO:`, extractedSkills.map(s => s.skill_name));

          // Determine source name (course or module title)
          let sourceName = 'Course Assessment';
          let sourceId = learningObjective.course_id;

          // Try to get a more specific source name
          // Note: Supabase joins return arrays, so access first element
          const module = Array.isArray(learningObjective.modules) ? learningObjective.modules[0] : learningObjective.modules;
          const course = Array.isArray(learningObjective.courses) ? learningObjective.courses[0] : learningObjective.courses;
          const instructorCourse = module && Array.isArray(module.instructor_courses) ? module.instructor_courses[0] : module?.instructor_courses;

          if (instructorCourse?.title) {
            sourceName = instructorCourse.title;
            sourceId = module?.instructor_course_id;
          } else if (module?.title) {
            sourceName = module.title;
            sourceId = learningObjective.module_id;
          } else if (course?.title) {
            sourceName = course.title;
            sourceId = learningObjective.course_id;
          }

          // Record each extracted skill
          for (const skill of extractedSkills) {
            const { data: verifiedSkill, error: skillError } = await supabase
              .from('verified_skills')
              .upsert({
                user_id: user.id,
                skill_name: skill.skill_name,
                proficiency_level: skill.proficiency_level,
                source_type: 'course_assessment',
                source_id: sourceId || session.learning_objective_id,
                source_name: sourceName,
                verified_at: completedAt,
                metadata: {
                  learning_objective_id: session.learning_objective_id,
                  assessment_session_id: session_id,
                  score: totalScore,
                  skill_category: skill.skill_category,
                  extraction_confidence: skill.confidence,
                  bloom_level: learningObjective.bloom_level,
                },
              }, {
                onConflict: 'user_id,skill_name,source_type,source_id',
              })
              .select()
              .single();

            if (skillError) {
              console.error(`Error recording skill "${skill.skill_name}":`, skillError);
            } else {
              verifiedSkillsRecorded.push(skill.skill_name);
              console.log(`Recorded verified skill: ${skill.skill_name} (${skill.proficiency_level})`);
            }
          }
        } catch (skillExtractionError) {
          console.error('Error extracting/recording skills:', skillExtractionError);
          // Don't fail the assessment completion, just log the error
        }
      }
    }

    // Generate performance summary
    const performanceSummary = {
      total_questions: session.question_ids.length,
      questions_answered: questionsAnswered,
      questions_correct: questionsCorrect,
      questions_incorrect: questionsAnswered - questionsCorrect,
      questions_skipped: session.question_ids.length - questionsAnswered,
      total_score: Math.round(totalScore * 10) / 10,
      passed,
      passing_threshold: PASSING_THRESHOLD,
      total_time_seconds: totalTimeSeconds,
      avg_time_per_question: Math.round(avgTimePerQuestion * 10) / 10,
      timing_anomalies: timingFlags,
      attempt_number: session.attempt_number,
    };

    // Categorize answers by correctness for review
    const correctAnswers = answers?.filter(a => a.is_correct) || [];
    const incorrectAnswers = answers?.filter(a => !a.is_correct) || [];

    console.log(`Assessment completed. Score: ${totalScore.toFixed(1)}%, Passed: ${passed}`);

    return new Response(JSON.stringify({
      success: true,
      session: updatedSession,
      performance: performanceSummary,
      correct_answers: correctAnswers.map(a => a.question_id),
      incorrect_answers: incorrectAnswers.map(a => ({
        question_id: a.question_id,
        user_answer: a.user_answer,
        evaluation_details: a.evaluation_details,
      })),
      learning_objective_verified: passed,
      verified_skills: verifiedSkillsRecorded,
      skills_count: verifiedSkillsRecorded.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in complete-assessment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete assessment';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
