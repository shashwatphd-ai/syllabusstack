import { Resend } from "npm:resend@^2.0.0";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";

interface DigestData {
  user_email: string;
  user_name: string;
  // Progress summary
  recommendations_completed_this_week: number;
  total_pending_recommendations: number;
  learning_progress_percent: number;
  content_watched_this_week: number;
  // Gap analysis insights
  top_priority_gap?: {
    skill: string;
    importance: string;
  };
  next_action?: string;
  // New content
  new_content_count: number;
  new_content_items: Array<{
    title: string;
    course_name: string;
    type: string;
  }>;
  // Achievements
  new_achievements: Array<{
    name: string;
    xp_reward: number;
  }>;
  total_xp: number;
  current_level: number;
  // Personalized tips
  personalized_tip: string;
  // Meta
  days_since_active: number;
}

const PERSONALIZED_TIPS = [
  "Setting specific learning goals each week can increase your completion rate by up to 40%.",
  "Try to complete at least one learning objective per day to maintain momentum.",
  "Review your gap analysis regularly to ensure you're focusing on the most impactful skills.",
  "Engaging with content ratings helps improve recommendations for everyone.",
  "Sharing resources you find helpful earns you XP and helps the community.",
  "Consistency beats intensity - even 15 minutes of focused learning daily compounds over time.",
  "Link your dream jobs to courses to see how your learning aligns with career goals.",
  "Take assessments after watching content to reinforce your learning.",
];

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Get eligible users
    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, email_preferences, last_active_at')
      .or(`last_active_at.lt.${oneWeekAgo.toISOString()},last_active_at.is.null`);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`Found ${eligibleUsers?.length || 0} potentially eligible users`);

    const emailsSent: string[] = [];
    const errors: string[] = [];

    for (const user of eligibleUsers || []) {
      const prefs = user.email_preferences as { weekly_digest?: boolean } | null;
      if (!prefs?.weekly_digest) {
        console.log(`User ${user.user_id} has weekly digest disabled, skipping`);
        continue;
      }

      if (!user.email) {
        console.log(`User ${user.user_id} has no email, skipping`);
        continue;
      }

      try {
        // Gather all digest data for this user
        const digestData = await gatherDigestData(supabase, user, oneWeekAgo);

        // Send the enhanced digest email
        const { error: emailError } = await resend.emails.send({
          from: "SyllabusStack <noreply@resend.dev>",
          to: [user.email],
          subject: generateSubject(digestData),
          html: generateEnhancedDigestHtml(digestData),
        });

        if (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
          errors.push(user.email);
        } else {
          console.log(`Successfully sent digest to ${user.email}`);
          emailsSent.push(user.email);

          await supabase
            .from('profiles')
            .update({ last_digest_sent_at: new Date().toISOString() })
            .eq('user_id', user.user_id);
        }
      } catch (userError) {
        console.error(`Error processing user ${user.user_id}:`, userError);
        errors.push(user.email || user.user_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: emailsSent.length,
        errors: errors.length,
        details: { sent: emailsSent, failed: errors }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    logError("send-digest-email", error instanceof Error ? error : new Error(String(error)), { action: "sending_digest" });
    return createErrorResponse("INTERNAL_ERROR", corsHeaders, error instanceof Error ? error.message : "Unknown error");
  }
};

async function gatherDigestData(
  supabase: any,
  user: { user_id: string; email: string; full_name: string | null; last_active_at: string | null },
  oneWeekAgo: Date
): Promise<DigestData> {
  const userId = user.user_id;

  // Get recommendations stats
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('title, status, updated_at')
    .eq('user_id', userId) as { data: Array<{ title: string; status: string; updated_at: string }> | null };

  const completedThisWeek = recommendations?.filter(
    (r: any) => r.status === 'completed' && r.updated_at && new Date(r.updated_at) > oneWeekAgo
  ).length || 0;
  const pendingTotal = recommendations?.filter((r: any) => r.status === 'pending').length || 0;

  // Get learning progress from course_enrollments
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('instructor_course_id, overall_progress')
    .eq('student_id', userId) as { data: Array<{ instructor_course_id: string; overall_progress: number | null }> | null };

  const avgProgress = enrollments?.length
    ? Math.round(enrollments.reduce((sum: number, e: any) => sum + (e.overall_progress || 0), 0) / enrollments.length)
    : 0;

  // Get content watched this week from consumption_records
  const { count: contentWatchedCount } = await supabase
    .from('consumption_records')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .gte('created_at', oneWeekAgo.toISOString());

  // Get top priority from gap_analyses
  const { data: gapAnalysis } = await supabase
    .from('gap_analyses')
    .select('critical_gaps, priority_gaps')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1) as { data: Array<{ critical_gaps: any; priority_gaps: any }> | null };

  const topPriorityGap = gapAnalysis?.[0]?.critical_gaps?.[0] ? {
    skill: gapAnalysis[0].critical_gaps[0].skill || 'Skill gap identified',
    importance: gapAnalysis[0].critical_gaps[0].importance || 'high',
  } : undefined;

  // Get next recommendation
  const nextRec = recommendations?.find((r: any) => r.status === 'pending')?.title;

  // Get new content added to enrolled courses
  const courseIds = enrollments?.map((e: any) => e.instructor_course_id) || [];
  let newContentItems: DigestData['new_content_items'] = [];
  let newContentCount = 0;

  if (courseIds.length > 0) {
    const { data: newContent, count } = await supabase
      .from('content')
      .select(`
        title,
        source_type,
        learning_objective:learning_objectives(
          module:modules(
            course:courses(title)
          )
        )
      `, { count: 'exact' })
      .in('learning_objective.module.course_id', courseIds)
      .gte('created_at', oneWeekAgo.toISOString())
      .limit(5);

    newContentCount = count || 0;
    newContentItems = (newContent || []).slice(0, 3).map((c: any) => ({
      title: c.title || 'Untitled',
      course_name: c.learning_objective?.module?.course?.title || 'Unknown Course',
      type: c.source_type || 'video',
    }));
  }

  // Get new achievements
  const { data: newAchievements } = await supabase
    .from('user_achievements')
    .select(`
      earned_at,
      achievement:achievements(name, xp_reward)
    `)
    .eq('user_id', userId)
    .gte('earned_at', oneWeekAgo.toISOString());

  // Get XP and level
  const { data: userXP } = await supabase
    .from('user_xp')
    .select('total_xp, level')
    .eq('user_id', userId)
    .single() as { data: { total_xp: number; level: number } | null };

  // Calculate days since active
  const lastActive = user.last_active_at ? new Date(user.last_active_at) : new Date(0);
  const daysSince = Math.ceil((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

  // Select a personalized tip
  const tipIndex = Math.floor(Math.random() * PERSONALIZED_TIPS.length);

  return {
    user_email: user.email,
    user_name: user.full_name || 'there',
    recommendations_completed_this_week: completedThisWeek,
    total_pending_recommendations: pendingTotal,
    learning_progress_percent: avgProgress,
    content_watched_this_week: contentWatchedCount || 0,
    top_priority_gap: topPriorityGap,
    next_action: nextRec,
    new_content_count: newContentCount,
    new_content_items: newContentItems,
    new_achievements: (newAchievements || []).map((a: any) => ({
      name: a.achievement?.name || 'Achievement',
      xp_reward: a.achievement?.xp_reward || 0,
    })),
    total_xp: userXP?.total_xp || 0,
    current_level: userXP?.level || 1,
    personalized_tip: PERSONALIZED_TIPS[tipIndex],
    days_since_active: daysSince,
  };
}

function generateSubject(data: DigestData): string {
  if (data.new_achievements.length > 0) {
    return `🏆 You earned ${data.new_achievements.length} new achievement${data.new_achievements.length > 1 ? 's' : ''}! Here's your weekly update`;
  }
  if (data.recommendations_completed_this_week > 0) {
    return `📈 Great progress! ${data.recommendations_completed_this_week} recommendations completed this week`;
  }
  if (data.total_pending_recommendations > 0) {
    return `${data.total_pending_recommendations} skill gap${data.total_pending_recommendations > 1 ? 's' : ''} waiting for your attention`;
  }
  return `Your Weekly Career Progress Update from SyllabusStack`;
}

function generateEnhancedDigestHtml(data: DigestData): string {
  const achievementsHtml = data.new_achievements.length > 0 ? `
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #92400e; display: flex; align-items: center; gap: 8px;">
        🏆 Achievements Unlocked!
      </h3>
      <div style="display: flex; flex-wrap: wrap; gap: 10px;">
        ${data.new_achievements.map(a => `
          <div style="background: white; padding: 10px 15px; border-radius: 6px; display: inline-block;">
            <strong>${a.name}</strong>
            <span style="color: #667eea; font-size: 14px; margin-left: 8px;">+${a.xp_reward} XP</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const newContentHtml = data.new_content_count > 0 ? `
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #10b981;">📚 New Content Available</h3>
      <p style="color: #6b7280;">${data.new_content_count} new resource${data.new_content_count > 1 ? 's' : ''} added to your enrolled courses:</p>
      <ul style="list-style: none; padding: 0; margin: 10px 0 0;">
        ${data.new_content_items.map(c => `
          <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
            <strong>${c.title}</strong>
            <span style="display: block; font-size: 12px; color: #9ca3af;">${c.course_name} • ${c.type}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  const gapAnalysisHtml = data.top_priority_gap ? `
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-weight: 500; color: #dc2626;">🎯 Top Priority Skill Gap:</p>
      <p style="margin: 8px 0 0; font-size: 18px;"><strong>${data.top_priority_gap.skill}</strong></p>
      <p style="margin: 4px 0 0; color: #9ca3af; font-size: 14px;">Importance: ${data.top_priority_gap.importance}</p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Weekly Career Progress</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f3f4f6;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">SyllabusStack</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">Your Weekly Career Progress Update</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="font-size: 18px; margin-top: 0;">Hey ${data.user_name}! 👋</p>

        <p>Here's what happened this week and what's next on your learning journey:</p>

        <!-- Progress Summary -->
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">📊 This Week's Progress</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="text-align: center; padding: 15px; background: white; border-radius: 8px;">
              <div style="font-size: 28px; font-weight: bold; color: #667eea;">${data.recommendations_completed_this_week}</div>
              <div style="font-size: 12px; color: #6b7280;">Completed</div>
            </div>
            <div style="text-align: center; padding: 15px; background: white; border-radius: 8px;">
              <div style="font-size: 28px; font-weight: bold; color: #f59e0b;">${data.total_pending_recommendations}</div>
              <div style="font-size: 12px; color: #6b7280;">Pending</div>
            </div>
            <div style="text-align: center; padding: 15px; background: white; border-radius: 8px;">
              <div style="font-size: 28px; font-weight: bold; color: #10b981;">${data.content_watched_this_week}</div>
              <div style="font-size: 12px; color: #6b7280;">Content Watched</div>
            </div>
            <div style="text-align: center; padding: 15px; background: white; border-radius: 8px;">
              <div style="font-size: 28px; font-weight: bold; color: #8b5cf6;">${data.learning_progress_percent}%</div>
              <div style="font-size: 12px; color: #6b7280;">Avg Progress</div>
            </div>
          </div>
        </div>

        <!-- XP & Level -->
        <div style="background: linear-gradient(135deg, #667eea10 0%, #764ba210 100%); padding: 15px 20px; border-radius: 8px; margin: 20px 0; display: flex; align-items: center; gap: 15px;">
          <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 20px;">
            ${data.current_level}
          </div>
          <div>
            <div style="font-weight: 600;">Level ${data.current_level}</div>
            <div style="font-size: 14px; color: #6b7280;">${data.total_xp.toLocaleString()} Total XP</div>
          </div>
        </div>

        ${achievementsHtml}

        ${gapAnalysisHtml}

        ${data.next_action ? `
        <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: 500; color: #1d4ed8;">💡 Suggested next action:</p>
          <p style="margin: 8px 0 0;">${data.next_action}</p>
        </div>
        ` : ''}

        ${newContentHtml}

        <!-- Personalized Tip -->
        <div style="background: #fdf4ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #a855f7;">
          <p style="margin: 0; font-weight: 500; color: #7e22ce;">💜 Pro Tip</p>
          <p style="margin: 8px 0 0; font-style: italic; color: #6b7280;">${data.personalized_tip}</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <a href="https://syllabusstack.com/dashboard"
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Continue Your Journey →
          </a>
        </div>

        <p style="margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center;">
          You're receiving this because you opted in for weekly digests.<br>
          <a href="https://syllabusstack.com/settings" style="color: #667eea;">Update your preferences</a> |
          <a href="https://syllabusstack.com/settings/notifications" style="color: #667eea;">Unsubscribe</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

Deno.serve(withErrorHandling(handler, getCorsHeaders));
