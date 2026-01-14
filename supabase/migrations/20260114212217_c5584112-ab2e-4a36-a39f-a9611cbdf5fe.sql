-- Fix the recommendations_with_links view to use SECURITY INVOKER
-- This ensures RLS policies are enforced when querying this view

-- Drop and recreate the view with security_invoker = on
DROP VIEW IF EXISTS public.recommendations_with_links;

CREATE VIEW public.recommendations_with_links
WITH (security_invoker = on)
AS
SELECT 
    r.id,
    r.user_id,
    r.dream_job_id,
    r.title,
    r.type,
    r.description,
    r.provider,
    r.url,
    r.duration,
    r.priority,
    r.status,
    r.created_at,
    r.updated_at,
    r.gap_analysis_id,
    r.why_this_matters,
    r.steps,
    r.evidence_created,
    r.how_to_demonstrate,
    r.effort_hours,
    r.cost_usd,
    r.gap_addressed,
    r.deleted_at,
    r.price_known,
    rcl.instructor_course_id,
    rcl.learning_objective_id,
    rcl.external_course_url AS linked_external_url,
    rcl.link_type,
    rcl.link_status,
    rcl.progress_percentage AS link_progress,
    ic.title AS linked_course_title,
    ic.code AS linked_course_code,
    ce.overall_progress AS enrollment_progress,
    ce.completed_at AS enrollment_completed_at
FROM recommendations r
LEFT JOIN recommendation_course_links rcl ON r.id = rcl.recommendation_id
LEFT JOIN instructor_courses ic ON rcl.instructor_course_id = ic.id
LEFT JOIN course_enrollments ce ON rcl.instructor_course_id = ce.instructor_course_id 
    AND r.user_id = ce.student_id
WHERE r.deleted_at IS NULL;

-- Grant access to authenticated users
GRANT SELECT ON public.recommendations_with_links TO authenticated;

-- Add comment documenting the security configuration
COMMENT ON VIEW public.recommendations_with_links IS 'Secure view with SECURITY INVOKER - RLS policies are enforced for the querying user';