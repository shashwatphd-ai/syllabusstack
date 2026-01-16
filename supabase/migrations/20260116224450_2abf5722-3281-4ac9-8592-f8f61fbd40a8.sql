-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view content ratings" ON content_ratings;

-- Create a scoped policy that preserves social features for enrolled users
CREATE POLICY "Users can view own ratings and ratings for enrolled content" 
ON content_ratings FOR SELECT 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM content_matches cm
    JOIN learning_objectives lo ON lo.id = cm.learning_objective_id
    JOIN course_enrollments ce ON ce.instructor_course_id = lo.instructor_course_id
    WHERE cm.content_id = content_ratings.content_id
    AND ce.student_id = auth.uid()
    AND cm.status = 'approved'
  )
);