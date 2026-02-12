

# Fix: Remove Premature Video Search from QuickCourseSetup

## The Problem

The QuickCourseSetup pipeline currently does this:

```text
Syllabus Upload
  --> process-syllabus (extracts modules + LOs)
  --> IMMEDIATELY searches YouTube for each LO        <-- WRONG
  --> IMMEDIATELY submits batch evaluation             <-- WRONG
  --> Shows "Videos Found" (empty/poor results)
```

But the platform's proper content discovery architecture requires an intermediate step -- **teaching unit decomposition** -- before video search makes sense:

```text
Syllabus Upload
  --> process-syllabus (extracts modules + LOs)
  --> Instructor opens LO --> "Analyze & Break Down" (curriculum-reasoning-agent)
      --> Creates teaching units with:
          - search_queries (AI-optimized)
          - target_video_type (explainer, tutorial, etc.)
          - target_duration_minutes
          - required_concepts / avoid_terms
  --> "Find Videos" per teaching unit
      --> search-youtube-content with teaching_unit_id + refined criteria
      --> Videos matched to specific teaching units
```

The raw LO data (e.g., "Understand SWOT analysis") produces vague YouTube searches. Teaching units break that into precise micro-concepts (e.g., "SWOT matrix construction tutorial, 8 min, explainer") that yield high-quality matches.

## The Correct Flow

QuickCourseSetup should stop after saving the course structure. Video discovery is an instructor-driven curation step that happens inside the course detail page, after teaching units exist.

```text
BEFORE (current):
  Upload --> Extract --> Save --> Search Videos --> Evaluate --> Complete
  (6 steps, last 2 produce poor results)

AFTER (proposed):
  Upload --> Extract --> Save --> Complete
  (3 steps, clean handoff to course detail page)
```

## Changes

### 1. Remove video search and evaluation steps from QuickCourseSetup.tsx

**Lines 36-44** (Step type): Remove `finding_content` and `evaluating_content` from the Step union and STEP_INFO.

**Lines 238-320** (Pipeline logic): Remove the entire "Step 3: Find content" and "Step 4: Trigger batch evaluation" blocks. After saving the structure, go directly to `setStep('complete')`.

**Lines 562-582** (Complete page UI): Replace the "Videos Found" card with a helpful indicator like "Ready for Review" or "Teaching Units: Pending" -- something that tells the instructor the next step is to review modules and break down LOs.

### 2. Remove related state variables

Remove `contentProgress`, `evaluationBatchJobId`, and `evaluationProgress` state variables and all their references (they're only used by the removed steps).

### 3. Update progress bar and step labels

Adjust the STEP_INFO progress percentages so the remaining steps (upload, extracting, analyzing, creating_course, saving_structure, complete) distribute evenly across 0-100%.

### 4. Update the "Review & Curate Content" button guidance

The button already navigates to the course detail page. No change needed there, but update the completion message to say something like "Your course structure is ready. Open it to break down objectives and find matching content."

## What Does NOT Change

- The course detail page (InstructorCourseDetail.tsx) -- already has the proper "Analyze & Break Down" and "Find Videos" workflow
- UnifiedLOCard.tsx -- already has the teaching unit decomposition and per-unit search
- useTeachingUnits.ts -- already has useDecomposeLearningObjective and useSearchForTeachingUnit
- All edge functions -- untouched
- Database schema -- untouched

## Technical Details

File: `src/pages/instructor/QuickCourseSetup.tsx`

- Remove Step type members: `finding_content`, `evaluating_content`
- Remove STEP_INFO entries for those steps
- Remove state: `contentProgress`, `evaluationBatchJobId`, `evaluationProgress`
- Remove lines 238-320 (video search + batch evaluation logic)
- After line 236 (`setResult(processResult)`), go directly to `setStep('complete')`
- Update the stats card from "Videos Found" to "Next Step: Break Down & Find Content"
- Adjust progress percentages: upload(0), extracting(20), analyzing(50), creating_course(70), saving_structure(90), complete(100)

