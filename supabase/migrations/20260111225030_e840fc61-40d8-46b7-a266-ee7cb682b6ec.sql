-- Add 'suggested' to the link_status check constraint for recommendation_course_links
-- First drop the existing constraint, then add the new one

ALTER TABLE recommendation_course_links 
DROP CONSTRAINT IF EXISTS recommendation_course_links_link_status_check;

ALTER TABLE recommendation_course_links 
ADD CONSTRAINT recommendation_course_links_link_status_check 
CHECK (link_status IN ('active', 'completed', 'abandoned', 'suggested'));

-- Add a comment to document the new status
COMMENT ON COLUMN recommendation_course_links.link_status IS 'Status of the link: active (confirmed by user), completed (course finished), abandoned (user gave up), suggested (auto-matched by system, pending user confirmation)';