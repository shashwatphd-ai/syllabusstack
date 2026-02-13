
# CDN Import Migration Progress

## Status: ~50 of ~82 files migrated ✅

### Completed Files (imports + Deno.serve)
- _shared/ (8 files - done previously)
- generate-batch-audio, generate-lecture-audio (done previously)
- complete-skills-assessment, discover-dream-jobs, search-khan-academy
- generate-assessment-questions, extract-learning-objectives, process-batch-images
- get-usage-stats, verify-instructor-email, submit-assessment-answer
- ai-gateway, analyze-syllabus, search-jobs, auto-link-courses
- search-youtube-manual, poll-batch-status, cancel-batch-job
- get-invoices, identity-verification-status
- poll-batch-curriculum, send-student-message, gap-analysis
- purchase-certificate, add-manual-content, analyze-dream-job
- cancel-subscription, compare-web-providers, complete-assessment
- configure-organization-sso, content-assistant-chat
- create-checkout-session, create-course-payment, create-portal-session
- create-webhook, invite-users, idv-webhook
- process-syllabus, search-educational-content, remove-org-user
- use-invite-code, generate-curriculum, generate-search-context
- generate-content-strategy, poll-active-batches, generate-recommendations
- parse-syllabus-document, submit-skills-response
- firecrawl-search-courses, verify-certificate

### Remaining Files (~32) - Need same mechanical fix
- process-batch-research, employer-verify-completion, search-youtube-content
- send-digest-email (also has Resend CDN import), curriculum-reasoning-agent
- trigger-pending-evaluations, generate-micro-checks, generate-lecture-slides-v3
- get-onet-occupation, submit-batch-curriculum, enroll-in-course
- stripe-webhook, scrape-job-posting, start-skills-assessment
- match-careers, record-proctor-event, start-assessment
- fetch-video-metadata, submit-batch-slides, submit-batch-evaluation
- poll-batch-evaluation, process-lecture-queue, track-consumption
- trigger-progressive-generation, send-employer-webhook
- global-search, issue-certificate, employer-verify-completion
- add-instructor-content

### Pattern for each remaining file:
1. `import { serve } from "https://deno.land/..."` → DELETE
2. `import { createClient } from "https://esm.sh/..."` → `import { createClient } from "@supabase/supabase-js"`
3. `import Stripe from "https://esm.sh/stripe@..."` → `import Stripe from "npm:stripe@^18.5.0"`
4. `import { Resend } from "https://esm.sh/resend@..."` → `import { Resend } from "npm:resend@^2.0.0"`
5. `serve(...)` → `Deno.serve(...)`

---

## Issue 2: Instructor Audio Preview

### Status: Pending implementation
Apply autoplay-safe Audio pattern in LectureSlideViewer.tsx for cross-browser reliability.
