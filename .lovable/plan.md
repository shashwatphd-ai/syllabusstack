

## Problem

Two issues are causing the red toast errors on the published site:

1. **Missing `poll-batch-status` edge function** -- The frontend code (`useBatchSlides.ts`) calls an edge function named `poll-batch-status`, but this function was never created. Every call returns a 404 error, which triggers the red error toast. This happens repeatedly because the hooks poll on an interval.

2. **Slide generation timeout (504)** -- The `generate-lecture-slides-v3` function timed out at 150 seconds. This is a secondary issue likely caused by slow AI responses.

The "old course" you see on the published site is expected -- when you publish, the database schema is deployed but data from development is NOT copied over. Any courses previously created on the live site remain there.

## Solution

Create the missing `poll-batch-status` edge function. This function needs to:

- Accept a `batch_job_id` (to check a specific batch) or `instructor_course_id` (to get overall course status)
- Query the `batch_jobs` and `lecture_slides` tables
- Return status counts matching the `BatchStatusResponse` and `CourseSlideStatusResponse` types the frontend expects

## Technical Details

### Step 1: Create `supabase/functions/poll-batch-status/index.ts`

A new edge function that:

- Handles CORS preflight using the shared CORS helpers
- Authenticates the user via JWT
- Supports two modes:
  - **Single batch mode** (`batch_job_id` provided): Queries the `batch_jobs` table for that job and counts slide statuses
  - **Course status mode** (`instructor_course_id` provided): Aggregates slide status counts across all teaching units in the course, plus active/recent batch info
- Returns JSON matching the `BatchStatusResponse` / `CourseSlideStatusResponse` interfaces

### Step 2: No frontend changes needed

The frontend hooks already call `poll-batch-status` correctly -- the function just needs to exist and return the expected shape.

