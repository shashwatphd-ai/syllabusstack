import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse, logInfo, logError, withErrorHandling } from "../_shared/error-handler.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-STUDENT-MESSAGE] ${step}${detailsStr}`);
};

interface SendMessageRequest {
  student_ids: string[];
  course_id: string;
  message: string;
  subject?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse request body
    const body: SendMessageRequest = await req.json();
    const { student_ids, course_id, message, subject } = body;

    if (!student_ids || student_ids.length === 0) {
      throw new Error("At least one student ID is required");
    }
    if (!course_id) throw new Error("Course ID is required");
    if (!message || message.trim().length === 0) {
      throw new Error("Message is required");
    }
    if (message.length > 1000) {
      throw new Error("Message is too long (max 1000 characters)");
    }

    logStep("Request parsed", {
      studentCount: student_ids.length,
      courseId: course_id,
      messageLength: message.length
    });

    // Verify the user is the instructor of this course
    const { data: course, error: courseError } = await supabaseAdmin
      .from("instructor_courses")
      .select("id, title, instructor_id")
      .eq("id", course_id)
      .eq("instructor_id", user.id)
      .single();

    if (courseError || !course) {
      throw new Error("You don't have permission to message students in this course");
    }
    logStep("Course verified", { courseTitle: course.title });

    // Verify all students are enrolled in this course
    const { data: enrollments, error: enrollError } = await supabaseAdmin
      .from("course_enrollments")
      .select("student_id")
      .eq("instructor_course_id", course_id)
      .in("student_id", student_ids);

    if (enrollError) throw enrollError;

    const enrolledStudentIds = new Set(enrollments?.map(e => e.student_id) || []);
    const invalidStudentIds = student_ids.filter(id => !enrolledStudentIds.has(id));

    if (invalidStudentIds.length > 0) {
      logStep("Warning: Some students not enrolled", { invalidCount: invalidStudentIds.length });
    }

    const validStudentIds = student_ids.filter(id => enrolledStudentIds.has(id));
    if (validStudentIds.length === 0) {
      throw new Error("None of the specified students are enrolled in this course");
    }

    // Get instructor profile for the notification
    const { data: instructorProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    const instructorName = instructorProfile?.full_name || "Your Instructor";

    // Create notifications for each student
    const notifications = validStudentIds.map(studentId => ({
      user_id: studentId,
      type: "instructor_message" as const,
      title: subject || `Message from ${instructorName}`,
      message: message.trim(),
      data: {
        course_id: course_id,
        course_title: course.title,
        instructor_id: user.id,
        instructor_name: instructorName,
      },
      read: false,
    }));

    const { data: createdNotifications, error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert(notifications)
      .select("id");

    if (notifError) {
      logStep("Error creating notifications", { error: notifError.message });
      throw new Error(`Failed to send notifications: ${notifError.message}`);
    }

    logStep("Notifications created", {
      count: createdNotifications?.length || 0,
      targetStudents: validStudentIds.length
    });

    // Optionally send email notifications for important messages
    // This could be integrated with Resend or another email service
    // For now, we just create in-app notifications

    return new Response(JSON.stringify({
      success: true,
      notifications_sent: createdNotifications?.length || 0,
      students_notified: validStudentIds.length,
      skipped_students: invalidStudentIds.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logError("send-student-message", error instanceof Error ? error : new Error(String(error)), { action: "sending_message" });
    return createErrorResponse("BAD_REQUEST", corsHeaders, error instanceof Error ? error.message : String(error));
  }
};

serve(withErrorHandling(handler, getCorsHeaders));
