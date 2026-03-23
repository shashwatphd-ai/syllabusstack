

# Fix 4 Quality Issues in Capstone Pipeline

## Issue 1: Random ROI Scores in ProjectReportView.tsx

**What's wrong**: Lines 196, 209, 222 use `Math.round(60 + Math.random() * 30)` for Stakeholder ROI sub-scores (Career Readiness, Skills Development, etc.). This produces different numbers on every render — meaningless data.

**Why it's wrong**: EduThree1 computes these from the `pricing-service.ts` ROI output. SyllabusStack already has `roi_multiplier` stored in `project_forms.form1_project_details.roi_multiplier` and the full ROI breakdown is computed in `generate-capstone-projects/index.ts` (line 174: `calculateApolloEnrichedROI`). The data exists but isn't stored granularly enough.

**Fix**: In `generate-capstone-projects/index.ts`, store the full ROI breakdown object (which `calculateApolloEnrichedROI` already returns) into `form1_project_details.roi_breakdown`. Then in `ProjectReportView.tsx`, derive sub-scores deterministically from the stored ROI data (e.g., `roi_multiplier * weight` per category). If no ROI data exists, show "N/A" instead of random numbers.

---

## Issue 2: Duplicate "employees" Text in CompanyCard.tsx

**What's wrong**: `discover-companies/index.ts` line 253 stores `employee_count` as a string like `"150"` or `"51-200 employees"` (Apollo sometimes includes the word). Then `CompanyCard.tsx` line 69 appends `" employees"` again, producing `"51-200 employees employees"`.

**Fix**: In `CompanyCard.tsx`, strip the word "employees" from the stored value before displaying, or display the raw value without appending. One line change: remove `employees` from the template literal and let the raw value speak for itself, OR sanitize with `.replace(/\s*employees$/i, '')`.

---

## Issue 3: Duplicated Completeness Function

**What's wrong**: `calculateCompleteness()` exists in `discover-companies/index.ts` (line 362, scores basic search fields, max 100) AND `calculateEnrichmentCompleteness()` exists in `apollo-enrichment-service.ts` (line 355, scores enriched fields, max 100). Both normalize to 0-1. The discover function uses `enrichData?.completenessScore ?? calculateCompleteness(original)` (line 267), so they're fallbacks of each other — but they score different things with different weights, which is confusing.

**Fix**: Remove `calculateCompleteness()` from `discover-companies/index.ts`. Always use `calculateEnrichmentCompleteness()` from the enrichment service. When enrichment doesn't run (fallback path), call it with `null` values — it already handles nulls and returns a low score, which is correct for unenriched companies.

---

## Issue 4: Unused Bloom Tier

**What's wrong**: `generate-capstone-projects/index.ts` line 82 computes `bloomTier` (Guided/Applied/Advanced) from learning objectives' Bloom levels, logs it, then never uses it. The `generateProjectProposal()` call on line 140 doesn't receive it. The AI prompt generates its own tier independently.

**Fix**: Pass `bloomTier` as a parameter to `generateProjectProposal()` in `generation-service.ts`. Add it to the prompt as a constraint: "The project MUST be at {bloomTier} complexity level" with definitions (Guided = structured tasks, Applied = open-ended analysis, Advanced = original research/creation). This ensures Bloom-level calibration flows through to the generated output instead of being discarded.

---

## Files to Change

| File | Change |
|---|---|
| `generate-capstone-projects/index.ts` | Store full ROI breakdown in form1; pass `bloomTier` to `generateProjectProposal()` |
| `_shared/capstone/generation-service.ts` | Accept `bloomTier` param, add to prompt |
| `src/components/capstone/ProjectReportView.tsx` | Replace `Math.random()` with deterministic ROI derivation from stored data |
| `src/components/capstone/CompanyCard.tsx` | Strip duplicate "employees" text |
| `discover-companies/index.ts` | Remove `calculateCompleteness()`, import from enrichment service |

