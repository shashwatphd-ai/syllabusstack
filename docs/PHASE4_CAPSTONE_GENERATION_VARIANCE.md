# Phase 4: Capstone Project Generation Variance

> **Report Date:** 2026-03-26
> **Scope:** Why the two repos produce different capstone project results

---

## 1. End-to-End Pipeline Comparison

### `projectify-syllabus` Pipeline (3 steps)

```
Step 1: parse-syllabus (1 edge fn)
    Input:  PDF file + city/zip location
    AI:     Lovable Gateway → gemini-2.5-flash (tool calling)
    Output: course_profiles row (title, level, weeks, hrs_per_week, outcomes, artifacts, schedule)

Step 2: discover-companies (1 edge fn, 1,727 lines)
    Input:  course_profiles row
    Pipeline: 5-phase (Skill→Occupation→Discovery→Validation→Ranking)
    APIs:   Apollo.io + Lightcast + O*NET
    Output: company_profiles rows + company_signals rows

Step 3: generate-projects (1 edge fn)
    Input:  course_profiles + company_profiles
    AI:     Lovable Gateway → gemini-2.5-flash/pro
    Steps:  Signal filtering → Project generation → LO scoring → Market scoring → Pricing/ROI
    Output: projects rows (flat table)
```

### `syllabusstack` Pipeline (5+ steps)

```
Step 1a: parse-syllabus-document (edge fn)
    Input:  PDF file
    Output: Raw text extraction only (no AI)

Step 1b: analyze-syllabus (edge fn)
    Input:  Raw text + courseId
    AI:     OpenRouter → gemini-2.5-flash-lite (structured generation)
    Output: capabilities, course_themes, tools_learned, course_title, course_code
    Stores: courses + capabilities + capability_profiles tables

Step 1c: process-syllabus (orchestrator edge fn)
    Orchestrates 1a + 1b + learning objective extraction

Step 2: discover-companies (edge fn, 673 lines + shared capstone/ pipeline)
    Input:  instructor_courses + learning_objectives
    Pipeline: Same 5-phase (delegated to _shared/capstone/)
    APIs:   Apollo.io + Lightcast + O*NET
    Output: company_profiles rows (signals embedded, not separate table)

Step 3: generate-capstone-projects (edge fn)
    Input:  instructor_courses + learning_objectives + company_profiles
    AI:     OpenRouter → gemini-3-flash-preview (PROFESSOR_AI)
    Steps:
      3a: AI Company-Course Validation (reject poor fits)
      3b: Signal filtering (same synonym expansion)
      3c: Skip if 0 relevant jobs AND 0 relevant technologies
      3d: AI Project Proposal Generation (with Bloom's tier)
      3e: LO Alignment Scoring (AI)
      3f: Market Alignment Scoring (synonym expansion)
      3g: Pricing & ROI calculation
      3h: Stakeholder ROI breakdown
      3i: LO Alignment Detail (AI)
    Output: capstone_projects + project_forms (6 forms) + milestones
```

### `projectify-syllabus` has TWO Discovery Pipelines (feature-flagged)

**Legacy pipeline (default):** SOC mapping -> Apollo search -> Gemini embedding similarity -> 4-signal scoring
**New pipeline (`USE_NEW_PIPELINE=true`):** Lightcast NLP -> O*NET structured -> Apollo precise -> Lightcast skill ID validation -> Multi-factor ranking

New pipeline ranking weights:
| Factor | Weight |
|--------|--------|
| Semantic (Lightcast skill ID overlap) | 40% |
| Hiring (active job posting count) | 25% |
| Location (distance from university) | 15% |
| Size (company size fit) | 10% |
| Diversity (industry variety) | 10% |

**syllabusstack** uses only the legacy pipeline (ported), with the 4-signal scoring system.

---

## 2. Input Data Differences

### What goes INTO the AI prompt

| Input | `projectify-syllabus` | `syllabusstack` |
|-------|----------------------|-----------------|
| **Course source** | `course_profiles.outcomes` (raw syllabus outcomes) | `learning_objectives.text` (instructor-created LOs) |
| **Course title** | `course_profiles.title` (AI-extracted from PDF) | `instructor_courses.title` (instructor-entered) |
| **Academic level** | `course_profiles.level` (UG/MBA binary) | `instructor_courses.academic_level` (flexible string) |
| **Artifacts** | `course_profiles.artifacts` (AI-extracted from PDF) | `instructor_courses.expected_artifacts` (instructor-set) |
| **Bloom's tier** | **Not used** | Calculated from `learning_objectives.bloom_level` distribution |
| **Duration** | `course_profiles.weeks` (AI-extracted) | Hardcoded 15 weeks |
| **Hours/week** | `course_profiles.hrs_per_week` (AI-extracted) | Hardcoded 10 hrs/week |

**Critical variance source:** projectify uses AI-extracted outcomes from PDF. syllabusstack uses instructor-authored learning objectives. These can differ significantly in specificity and quality.

### Company Data Going In

| Data | `projectify-syllabus` | `syllabusstack` |
|------|----------------------|-----------------|
| **Company selection** | All companies from DB for course | Top N by `composite_signal_score` (pre-ranked) |
| **Pre-validation** | Uses `filterValidCompanies()` from validation service | AI-based `validateCompanyCourseMatch()` with confidence threshold |
| **Signal filtering** | `filterRelevantSignals()` with STEM synonyms only | `filterRelevantSignals()` with STEM + Business synonyms |
| **Skip logic** | No skip for zero signals | **Skips company** if 0 relevant jobs AND 0 relevant tech |

---

## 3. AI Generation Differences

### Model & Temperature

| Param | `projectify-syllabus` | `syllabusstack` |
|-------|----------------------|-----------------|
| Model | `google/gemini-2.5-flash` via Lovable | `google/gemini-3-flash-preview` via OpenRouter |
| Temperature | Default (likely 1.0) | 0.4 (more deterministic) |
| Max tokens | Default | 5000 |
| Provider | Lovable AI Gateway | OpenRouter |

**Impact:** Different model version (2.5 vs 3.0) + different temperature = noticeably different outputs even with identical prompts.

### Prompt Differences

| Section | `projectify-syllabus` | `syllabusstack` |
|---------|----------------------|-----------------|
| **Bloom's tier** | Absent | Present (`Guided`/`Applied`/`Advanced`) |
| **Course label** | "COURSE LEARNING OUTCOMES" | "COURSE LEARNING OBJECTIVES" |
| **Synonym map** | STEM-only (10 entries: ai, ml, cloud, data, software, fluid, mechanical, chemical, simulation, optimization) | STEM + Business (20 entries: + strategy, management, marketing, finance, accounting, supply, economics, entrepreneurship, analytics, consulting) |
| **Stop words** | 6 words excluded | 10 words excluded |
| **Subject guidance** | 5 domains | 5 domains (identical) but extra examples in Engineering/CS |
| **Mismatch rules** | 3 rules | 5 rules (adds: business course → engineering tasks, any course → no course knowledge required) |
| **Specificity examples** | Business only (2 good/bad pairs) | Business + Engineering + CS (4 good/bad pairs) |
| **JSON output** | Includes `company_needs`, `company_description`, `faculty_expertise`, `publication_opportunity` | Does **NOT** include these 4 fields |
| **Tier field** | `"standard|advanced|capstone"` | Uses Bloom's tier: `"guided|applied|advanced"` |

### Post-Generation Validation

**projectify-syllabus** (`cleanAndValidate` function):
- Strips markdown formatting from tasks/deliverables
- Removes week numbers from deliverables
- Checks description length (>50 words)
- Checks for generic-only skills
- Validates contact email format
- Flags overly long tasks (>20 words)

**syllabusstack** (`cleanArray` function):
- Strips markdown formatting
- Removes leading numbers/bullets
- Caps at target length (7 tasks, 6 deliverables, 7 skills)
- **No content quality validation** (relies on AI model quality)

---

## 4. Scoring System Differences

### LO Alignment Score

**Both repos:** Use `calculateLOAlignment()` from alignment-service.ts
- Input: tasks, deliverables, outcomes/objectives, lo_alignment text
- Method: Token overlap scoring with bonus for specific LO references
- Output: 0.0 - 1.0 score

### Market Alignment Score

**Both repos:** Use `calculateMarketAlignmentScore()` from alignment-service.ts
- Input: tasks, outcomes, job_postings, technologies, inferred_needs
- Method: Keyword matching with synonym expansion
- Output: 0-100 score

### Feasibility Score

**projectify-syllabus:**
```typescript
feasibility_score = weeks >= 12 ? 0.85 : 0.65;
// Fixed based on course duration only
```

**syllabusstack:**
```typescript
feasibilityScore = Math.min(1.0, (marketScore / 100) * 0.6 + 0.4);
// Dynamic, based on market alignment
```

### Final Composite Score

**projectify-syllabus:**
```typescript
final_score = 0.5 * lo_score + 0.3 * feasibility_score + 0.2 * mutual_benefit_score;
// mutual_benefit_score is fixed at 0.80
```

**syllabusstack:**
```typescript
finalScore = 0.5 * loScore + 0.3 * feasibilityScore + 0.2 * (validation.confidence || 0.7);
// Uses AI validation confidence instead of fixed mutual benefit
```

**Key scoring difference:** projectify uses fixed scores for feasibility (0.85) and mutual benefit (0.80). syllabusstack derives both from actual data (market alignment + AI validation confidence).

---

## 5. Output Storage Differences

### projectify-syllabus: Flat `projects` table

```sql
projects:
  id, course_id, company_profile_id
  title, description, tasks[], deliverables[], skills[]
  tier, lo_alignment, lo_alignment_score, feasibility_score, final_score
  contact (JSONB), equipment, majors[]
  faculty_expertise, publication_opportunity  -- EXTRA fields
  company_needs[], company_description       -- EXTRA fields
  budget, roi_multiplier
  status
```

### syllabusstack: Normalized 3-table structure

```sql
capstone_projects:
  id, instructor_course_id, company_profile_id
  title, description, tasks[], deliverables[], skills[]
  tier, lo_alignment, lo_alignment_score, feasibility_score, final_score
  contact (JSONB), equipment, majors[]
  status  -- NO faculty_expertise, publication_opportunity, company_needs

project_forms:  -- 6 JSONB columns
  capstone_project_id
  form1_project_details   → { title, industry, description, budget, roi_multiplier, roi_breakdown, value_components }
  form2_contact_info      → { company, contact_name, contact_email, contact_title, phone, website, linkedin }
  form3_requirements      → { skills, deliverables, learning_objectives, team_size, lo_alignment_detail }
  form4_timeline          → { weeks, hours_per_week, start_date, end_date }
  form5_logistics         → { type, scope, location, equipment, ip_agreement, past_experience }
  form6_academic          → { level, difficulty, majors, faculty_expertise, hours_per_week, category }
  milestones              → [ { title, week, deliverable, description } ]

capstone_generation_runs:  -- Progress tracking (syllabusstack only)
  id, instructor_course_id, started_by, status
  current_phase, phases_completed[], companies_discovered, projects_generated
  companies_validated, error_details, completed_at, total_processing_time_ms
```

---

## 6. Specific Variance Sources (Why Results Differ)

### Variance 1: Different AI Models
- **gemini-2.5-flash** (projectify) vs **gemini-3-flash-preview** (syllabusstack)
- Gemini 3 produces more structured, longer responses
- Gemini 3 follows complex instructions more reliably

### Variance 2: Bloom's Taxonomy Tier
- projectify: All projects generated at same complexity level
- syllabusstack: Projects adapted to `Guided`/`Applied`/`Advanced` based on LO Bloom levels
- A `Guided` tier project has "structured tasks with clear steps, templates provided"
- An `Advanced` tier project has "original research/creation with minimal scaffolding"

### Variance 3: Temperature Setting
- projectify: Default (~1.0) = more creative/variable outputs
- syllabusstack: 0.4 = more consistent/deterministic outputs
- Same prompt can produce vastly different projects at different temperatures

### Variance 4: Input Data Quality
- projectify: AI-extracted outcomes from PDF (may miss nuance, may hallucinate)
- syllabusstack: Instructor-authored learning objectives (higher quality, more specific)

### Variance 5: Company Validation Gate
- projectify: No AI pre-validation (all companies get projects generated)
- syllabusstack: AI validates company-course fit BEFORE generation, rejects poor matches (confidence >= 0.7)
- Result: syllabusstack generates fewer but higher-quality projects

### Variance 6: Signal Filtering Scope
- projectify: STEM synonyms only (10 entries)
- syllabusstack: STEM + Business synonyms (20 entries)
- Result: syllabusstack passes more relevant signals to AI for business courses

### Variance 7: Feasibility Scoring
- projectify: Fixed 0.85 for >= 12 weeks, 0.65 otherwise
- syllabusstack: Dynamic based on market alignment score
- Result: Different project ranking order

### Variance 8: Missing Fields
- projectify returns: `faculty_expertise`, `publication_opportunity`, `company_needs`, `company_description`
- syllabusstack does NOT return these fields
- Result: projectify projects have richer metadata

### Variance 9: Database Insert Strategy
- projectify: Uses `create_project_atomic` RPC (single transaction for project + forms + metadata)
- syllabusstack: Sequential inserts (`capstone_projects` -> `project_forms` -> `capstone_generation_runs` update)
- Result: projectify has atomic consistency guarantee; syllabusstack can have partial inserts on failure

### Variance 10: ROI Breakdown
- projectify: Simple `budget` + `roi_multiplier`
- syllabusstack: Full `roi_breakdown` with stakeholder categories, `value_components` array
- Result: syllabusstack has more detailed financial analysis per project

---

## 7. Frontend Display Differences

### projectify-syllabus: Project Detail
- `ProjectDetail.tsx` with tabs:
  - Overview, Contact, Market Insights, Value Analysis, Salary ROI, Skill Gap, Premium Insights, Algorithm, Verification
- Rich project metadata displayed inline
- Single-page detail view

### syllabusstack: Project Detail
- `ProjectDetailTabs.tsx` with 6-form tabbed interface:
  - Project Details (form1), Contact Info (form2), Requirements (form3), Timeline (form4), Logistics (form5), Academic (form6)
- Milestones displayed as timeline
- Integrated with instructor course management

---

**Next: Phase 5 - Unused Resources & Gap Analysis**
