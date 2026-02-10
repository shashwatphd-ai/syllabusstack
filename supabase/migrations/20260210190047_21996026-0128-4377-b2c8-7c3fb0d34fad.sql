-- Promote stuck pending_evaluation videos to pending so they appear in instructor review queue
UPDATE content_matches
SET status = 'pending', match_score = 0.5
WHERE status = 'pending_evaluation';