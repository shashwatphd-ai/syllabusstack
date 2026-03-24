

# Audit & Fix Plan: Capstone Pipeline Wiring Issues

## What You're Seeing vs What Should Happen

The screenshot shows the **Capstone Projects tab** is rendering correctly — 26 discovered companies with scores, badges, contacts, and technologies. The UI code is built and working. The core issues are:

1. **"Generate Projects" button does nothing visible** — it calls the edge function but likely times out (60s limit) processing 26 companies sequentially with AI calls + 1.5s delays between each
2. **Discovery config is not passed to the backend** — the `handleStartDiscovery` receives a `DiscoveryConfig` object but ignores it, only passing `courseId`
3. **No visible feedback when generation fails** — the toast fires on error but the edge function timeout manifests as a generic network error

## Complete Feature Map & Wiring Status

### Working (Visible in Screenshot)
- Company discovery (26 companies loaded) 
- Quality grades (B badges visible)
- Composite scores (60-62% visible)
- Job posting badges (1-10 Jobs)
- Confidence badges (medium)
- Intent badges (Low Intent)
- Social links, contact info, technologies, addresses
- Sort by composite/skill/market/department/contact
- Confidence filter dropdown

### Broken / Not Wired
1. **Generate Projects button** — edge function times out processing 26 companies with sequential AI calls (validation + proposal + LO alignment + pricing = ~4 AI calls per company x 26 = ~104 AI calls, well over 60s)
2. **Discovery config not passed** — `config` parameter is received but not sent to the edge function
3. **`feasibilityScore` used before declared** on line 183 of generate-capstone-projects (variable hoisting bug — `const` is used at line 194)

### Built But Not Navigable From Current View
- Student project browse (`/student/capstone-projects`) — exists but no sidebar link for students
- Syllabus Review page (`/instructor/courses/:id/review`) — route exists but no navigation link from course detail
- Admin Capstone Shells tab — wired into AdminDashboard
- Admin Employer Leads tab — wired into AdminDashboard
- Employer Interest Form — component exists, not integrated into employer dashboard
- Student Rating Dialog — component exists, not integrated
- Project Feedback Dialog — component exists, not integrated into project cards

## Implementation Plan

### Fix 1: Generate Projects Timeout (Critical)
The edge function processes companies sequentially with AI calls. With 26 companies, this far exceeds the 60s timeout.

- Cap companies processed to top 10 by composite score
- Remove the 1.5s `setTimeout` delay between companies (line 300-302)
- Add a `generation_runs`-style status tracking so the UI can poll progress
- If the function still times out, implement batch continuation pattern (process 3-5 companies per invocation, self-continue)

### Fix 2: Pass Discovery Config to Backend
- Modify `useDiscoverCompanies` mutation to accept `{ courseId, config }` 
- Pass `config.maxCompanies`, `config.targetIndustries`, `config.maxDistanceMiles`, `config.minEmployees` in the edge function body
- Consume these in `discover-companies/index.ts`

### Fix 3: Fix Variable Hoisting Bug
- In `generate-capstone-projects/index.ts` line 183, `feasibilityScore` is referenced before its `const` declaration on line 194. Move the declaration before the `buildStakeholderROI` call.

### Fix 4: Wire Missing Navigation
- Add "Review Syllabus" button/link on the Course Structure tab header
- Add "Capstone Projects" link in student sidebar navigation
- Integrate `ProjectFeedbackDialog` into `CapstoneProjectCard` (faculty feedback)
- Integrate `EmployerInterestForm` into employer dashboard

### Fix 5: Generation Progress Feedback
- Show `GenerationProgressCard` during project generation (not just discovery)
- Add a `capstone_generation_runs` entry when project generation starts
- Update the progress card to distinguish "discovery" vs "generation" phases

## Technical Details

**Variable hoisting bug (Fix 3):**
```text
Line 183: const roiBreakdown = buildStakeholderROI(roi, loScore, feasibilityScore);
          ← feasibilityScore not yet declared
Line 194: const feasibilityScore = Math.min(1.0, (marketScore / 100) * 0.6 + 0.4);
```
This causes a `ReferenceError` at runtime, silently killing project generation.

**Timeout math (Fix 1):**
Each company requires ~4 AI gateway calls (validation, proposal, LO alignment, LO detail). At ~3-5s per call = ~15s per company. 26 companies = ~390s, far exceeding the 60s limit. Capping to 8 companies + removing sleep = ~120s, still tight. Will implement batch continuation.

**Config passthrough (Fix 2):**
The `DiscoveryConfig` type has `targetIndustries`, `maxCompanies`, `maxDistanceMiles`, `minEmployees` — all already defined but the mutation only sends `courseId`.

