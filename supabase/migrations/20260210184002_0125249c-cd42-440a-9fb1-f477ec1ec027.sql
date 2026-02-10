ALTER TABLE content_matches
  DROP CONSTRAINT content_matches_status_check,
  ADD CONSTRAINT content_matches_status_check
    CHECK (status IN ('pending', 'pending_evaluation', 'auto_approved', 'approved', 'rejected', 'skipped'));