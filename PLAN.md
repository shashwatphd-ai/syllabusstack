# Plan: Intelligent Content Discovery Pipeline Redesign

## Problem Statement

The current pipeline treats YouTube like a textbook index — it searches `"<concept> tutorial"` 8 different ways, scores every result against a single "ideal classroom video" rubric, and filters aggressively. This produces "found 11 videos but none matched" because:

1. **Query generation is formulaic** — synonym swaps and Bloom-level prefixes, but no conceptual reasoning about what makes a topic interesting
2. **Content type blindness** — only searches for tutorials/lectures, ignores news, podcasts, documentaries, vlogs, case studies
3. **Scoring punishes non-academic content** — hardcoded channel authority (0.95 for universities, 0.40 for everyone else) eliminates brilliant science communicators, journalists, practitioners
4. **No portfolio diversity goal** — selects "best N tutorials" instead of "one tutorial + one curiosity trigger + one real-world case"
5. **AI evaluation prompt is a classroom rubric** — Mayer's Multimedia Principles and "Khan Academy = 88-95" makes the AI reject anything that isn't a structured lecture

## Dependency Constraints (DO NOT BREAK)

### Response contract (consumed by 3 front-end hooks + 5 components)
The response shape from `search-youtube-content` MUST remain:
```typescript
{
  success: boolean,
  content_matches: Array<...>,  // saved matches
  total_found: number,          // raw videos found
  viable_candidates: number,
  auto_approved_count: number,
  ai_evaluation_used: boolean,
  // ...additional fields OK (additive)
}
```

### `evaluate-content-batch` is shared by 5 edge functions
- `search-youtube-content`
- `add-instructor-content`
- `add-manual-content`
- `search-khan-academy`
- `search-educational-content`

Changes to its interface must be **backward compatible** (new optional fields only).

### Database tables
- `content_matches` schema: additive columns only (new nullable columns OK)
- `content` schema: additive columns only
- `content_search_cache` schema: no external consumers, can evolve freely

### Front-end consumers (read-only, no changes needed if response shape preserved)
- `src/hooks/useLearningObjectives.ts` — reads `content_matches`, `total_found`
- `src/hooks/useTeachingUnits.ts` — reads `videos_found`
- `src/services/content-service.ts` — calls `search-youtube-content`
- `src/components/instructor/UnifiedLOCard.tsx` — displays results
- `src/components/instructor/ContentCurationPanel.tsx` — displays results
- `src/components/instructor/ModuleCard.tsx` — displays results
- `src/components/instructor/ManualContentSearch.tsx` — independent manual path

### Locally-scoped (safe to change freely)
- `calculateDurationFitScore` — local to `search-youtube-content/index.ts`
- `calculateChannelAuthorityScore` — local to `search-youtube-content/index.ts`
- `MIN_DURATION_FIT` constant — local
- All query-intelligence internals (`orchestrator.ts`, `builders/`, `extractors/`, `expanders/`)

---

## Implementation Plan

### Phase 1: Content Role Reasoning (new file + changes to orchestrator)

**Goal**: Before generating search queries, use an LLM to reason about *what kinds of videos would be valuable* for this concept — not just tutorials.

#### 1.1 Create `supabase/functions/_shared/query-intelligence/reasoners/content-role-reasoner.ts`

New file. An LLM call (Gemini Flash, same model used elsewhere) that takes the learning objective context and returns a structured "content brief":

```typescript
interface ContentBrief {
  roles: ContentRole[];       // 3-5 roles to fill
  angles: string[];           // creative angles on the topic
  real_world_connections: string[];  // events, industries, phenomena
  search_strategies: SearchStrategy[]; // role-aware query suggestions
}

interface ContentRole {
  role: 'core_explainer' | 'curiosity_spark' | 'real_world_case' | 'practitioner_perspective' | 'debate_or_analysis' | 'adjacent_insight';
  description: string;        // what this role achieves for the learner
  target_content_types: string[]; // e.g. ['documentary', 'news clip', 'podcast excerpt']
  suggested_queries: string[];    // 2-3 queries targeting this role
  duration_flexibility: 'strict' | 'flexible' | 'any'; // how much duration matters for this role
}
```

Prompt instructs the LLM to think like a curious, creative teacher:
- "What real-world events, industries, or phenomena involve this concept?"
- "What would make a student say 'I didn't know that was connected'?"
- "What debates or controversies exist around this topic?"
- "What practitioners (engineers, doctors, economists, etc.) discuss this in accessible ways?"
- "What adjacent topics would deepen understanding through contrast or analogy?"

The LLM returns role-specific search strategies — e.g., for "supply and demand":
- Core explainer: `"supply and demand explained economics"`
- Curiosity spark: `"why are GPUs so expensive"`, `"economics of concert tickets"`
- Real-world case: `"housing crisis supply demand"`, `"uber surge pricing explained"`
- Practitioner perspective: `"economist explains inflation"`, `"trader explains market prices"`
- Adjacent insight: `"tulip mania history"`, `"how airlines price seats"`

**Timeout/fallback**: 5-second timeout. If the LLM call fails, fall back to the current query generation system (no regression).

#### 1.2 Modify `supabase/functions/_shared/query-intelligence/orchestrator.ts`

Add a new step at the beginning of `generateQueries()`:
1. Call content-role-reasoner to get the ContentBrief
2. Pass the ContentBrief's suggested queries into the existing builder pipeline as a new builder (`RoleAwareBuilder`, priority 11 — highest)
3. The existing `DirectSyllabusBuilder`, `BloomQueryBuilder`, `ModuleContextBuilder` remain as fallbacks
4. Increase `maxQueries` from 8 to 12 to accommodate role diversity
5. Tag each generated query with its `role` so downstream steps know what role each query serves

#### 1.3 Create `supabase/functions/_shared/query-intelligence/builders/role-aware-builder.ts`

New builder that takes the ContentBrief and produces queries tagged with their role. Priority 11 (highest). Each query carries metadata:
```typescript
interface GeneratedQuery {
  // existing fields preserved
  query: string;
  priority: number;
  source: string;
  derivedFrom?: string;
  // new field (additive)
  content_role?: ContentRole['role'];
}
```

The diversity filter in the orchestrator should ensure at least 1 query per role (up to the first 5 roles), then fill remaining slots with best queries from any role.

---

### Phase 2: Content-Type-Aware Query Suffixing

**Goal**: Vary queries to target different YouTube content formats.

#### 2.1 Modify search query execution in `search-youtube-content/index.ts`

Currently top 3 queries are searched. Change to:
- Search top 5 queries (up from 3) since they now cover different roles
- For queries tagged as non-tutorial roles, append content-type suffixes to *variant* searches:
  - `curiosity_spark`: search as-is (these queries are already creative)
  - `real_world_case`: append `"news"` or `"documentary"` as a variant
  - `practitioner_perspective`: append `"interview"` or `"podcast"` as a variant
  - `debate_or_analysis`: append `"debate"` or `"panel discussion"` as a variant
  - `adjacent_insight`: search as-is

This is additive — the core query still runs, with optional variant queries in parallel if budget allows.

#### 2.2 No changes to `_shared/youtube-search/*` files

The search sources (Firecrawl, Jina, Invidious) are content-type-agnostic — they search YouTube and return results. No changes needed.

---

### Phase 3: Scoring System Overhaul

**Goal**: Replace the rigid academic-biased scoring with role-aware, signal-based scoring.

#### 3.1 Replace `calculateChannelAuthorityScore` in `search-youtube-content/index.ts`

Replace the hardcoded 11-name list with a signal-based approach:

```typescript
function calculateChannelQualityScore(video: YouTubeSearchResult): number {
  let score = 0.5; // neutral baseline

  // View count signal (if available from metadata enrichment)
  if (video.view_count) {
    if (video.view_count > 1_000_000) score += 0.2;
    else if (video.view_count > 100_000) score += 0.15;
    else if (video.view_count > 10_000) score += 0.1;
    else if (video.view_count > 1_000) score += 0.05;
  }

  // Known high-quality educational creators (expanded, not just universities)
  const channel = (video.channel_name || '').toLowerCase();
  const highQualityCreators = [
    // Universities & MOOCs (keep existing)
    'university', 'mit', 'stanford', 'yale', 'harvard', 'khan academy',
    'coursera', 'edx', 'professor',
    // Science communicators
    '3blue1brown', 'veritasium', 'kurzgesagt', 'minutephysics',
    'vsauce', 'smarter every day', 'numberphile', 'computerphile',
    'crash course', 'ted-ed', 'ted', 'scishow',
    // Tech/CS educators
    'fireship', 'the coding train', 'traversy media', 'freecodecamp',
    'cs dojo', 'sentdex', 'two minute papers',
    // News/analysis (non-controversial, factual)
    'wendover productions', 'real engineering', 'practical engineering',
    'economics explained', 'polymatter', 'cnbc', 'bloomberg',
    'vox', 'caspian report',
    // Business/industry
    'y combinator', 'a]16z', 'harvard business review',
  ];
  if (highQualityCreators.some(c => channel.includes(c))) score += 0.15;

  // General educational signals in channel name
  const eduSignals = ['academy', 'edu', 'learn', 'school', 'institute', 'college'];
  if (eduSignals.some(s => channel.includes(s))) score += 0.05;

  return Math.min(score, 1.0);
}
```

This is a local function — no external dependencies.

#### 3.2 Revise `calculateDurationFitScore` in `search-youtube-content/index.ts`

Make duration scoring role-aware. Add `role` parameter:

```typescript
function calculateDurationFitScore(
  actualSeconds: number,
  expectedMinutes: number,
  role?: ContentRole['role']
): number {
  // For non-tutorial roles, duration is much less important
  if (role === 'curiosity_spark' || role === 'adjacent_insight') {
    // Short clips (1-10 min) are fine for curiosity content
    if (actualSeconds > 30 && actualSeconds < 600) return 0.9;
    if (actualSeconds >= 600 && actualSeconds < 1800) return 0.8;
    if (actualSeconds === 0) return 0.5; // unknown duration — don't kill it
    return 0.6;
  }

  if (role === 'real_world_case' || role === 'practitioner_perspective' || role === 'debate_or_analysis') {
    // News clips, interviews, podcasts — wide duration range OK
    if (actualSeconds > 60 && actualSeconds < 3600) return 0.85;
    if (actualSeconds === 0) return 0.5; // unknown — benefit of the doubt
    return 0.6;
  }

  // For core_explainer (tutorial), keep the existing logic but handle 0-duration
  if (actualSeconds === 0) return 0.4; // unknown duration — let AI evaluate

  const expectedSeconds = expectedMinutes * 60;
  const ratio = Math.min(actualSeconds, expectedSeconds) / Math.max(actualSeconds, expectedSeconds);
  if (actualSeconds >= expectedSeconds * 0.7 && actualSeconds <= expectedSeconds * 1.5) {
    return 0.8 + (ratio * 0.2);
  }
  if (actualSeconds < expectedSeconds * 0.5) return ratio * 0.4;
  if (actualSeconds > expectedSeconds * 2) return ratio * 0.5;
  return ratio * 0.7;
}
```

**Critical fix**: Videos with `duration_seconds === 0` (metadata enrichment failed) now get 0.4-0.5 instead of 0, so they pass the `MIN_DURATION_FIT = 0.3` gate and reach AI evaluation.

#### 3.3 Lower `MIN_DURATION_FIT` from 0.3 to 0.2

Since we now give unknown-duration videos a score of 0.4-0.5, this threshold is less critical, but lowering it adds safety margin. The AI evaluation (Step 5) is the real quality gate anyway.

---

### Phase 4: AI Evaluation Prompt Redesign

**Goal**: Make the AI evaluate videos against their *intended role*, not just as tutorials.

#### 4.1 Modify `evaluate-content-batch/index.ts` — backward compatible

Add an **optional** `content_roles` field to the request body:

```typescript
// Existing fields (unchanged)
learning_objective: string;
bloom_level?: string;
videos: Array<{...}>;
// New optional field
content_roles?: Record<string, ContentRole['role']>; // video_id -> role
```

When `content_roles` is provided, the AI evaluation prompt changes per-video:
- **core_explainer**: Current rubric (Mayer's principles, Bloom alignment) — unchanged
- **curiosity_spark**: "Does this video make the topic feel surprising, fascinating, or personally relevant? Would it make a student want to learn more?"
- **real_world_case**: "Does this video show a concrete, real-world instance of this concept in action? Is it from a credible source?"
- **practitioner_perspective**: "Does this video feature someone with real experience discussing this topic? Does it provide insights you wouldn't get from a textbook?"
- **debate_or_analysis**: "Does this video present multiple viewpoints, a thoughtful analysis, or a nuanced take on this topic?"
- **adjacent_insight**: "Does this video illuminate the topic through an unexpected connection, analogy, or adjacent field?"

When `content_roles` is NOT provided (calls from `add-instructor-content`, `search-khan-academy`, etc.), the existing rubric is used unchanged — **full backward compatibility**.

#### 4.2 Adjust scoring calibration in prompt

Add to the scoring guidance:
- A non-tutorial video (news clip, podcast, documentary) that brilliantly illustrates a concept should score 80+ for relevance even if it doesn't "teach" the concept directly
- A short (2-5 minute) curiosity-sparking clip can score 90+ for quality even without "step-by-step structure"
- The "tangentially related = never above 65" rule applies only to core_explainer role videos

#### 4.3 Add `content_role` field to AI evaluation response

Each video evaluation already returns `relevance_score`, `pedagogy_score`, `quality_score`, `total_score`, `recommendation`, `reasoning`. Add:
- `content_role`: the role this video was evaluated against (for downstream use)

This is additive to the response — no breaking change.

---

### Phase 5: Portfolio-Aware Selection

**Goal**: Select a diverse portfolio of videos covering different roles, not just top-N by score.

#### 5.1 Modify final filtering in `search-youtube-content/index.ts` (lines ~577-590)

Replace the simple "filter by score, cap at 10" with portfolio-aware selection:

```typescript
function selectPortfolio(
  candidates: ScoredVideo[],
  contentBrief: ContentBrief | null,
  maxTotal: number = 10
): ScoredVideo[] {
  if (!contentBrief) {
    // Fallback: current behavior (backward compatible)
    return candidates
      .filter(v => v.match_score >= 0.50 && v.ai_recommendation !== 'not_recommended')
      .slice(0, maxTotal);
  }

  const portfolio: ScoredVideo[] = [];
  const channelCounts = new Map<string, number>();
  const filledRoles = new Set<string>();

  // Pass 1: Best video per role (ensure diversity)
  for (const role of contentBrief.roles) {
    const roleVideos = candidates
      .filter(v =>
        v.content_role === role.role &&
        v.match_score >= 0.45 && // slightly lower threshold for non-tutorial roles
        v.ai_recommendation !== 'not_recommended' &&
        (channelCounts.get(v.video.channelId) || 0) < 2
      )
      .sort((a, b) => b.match_score - a.match_score);

    if (roleVideos.length > 0) {
      portfolio.push(roleVideos[0]);
      channelCounts.set(roleVideos[0].video.channelId,
        (channelCounts.get(roleVideos[0].video.channelId) || 0) + 1);
      filledRoles.add(role.role);
    }
  }

  // Pass 2: Fill remaining slots with best remaining videos (any role)
  const remaining = candidates
    .filter(v =>
      !portfolio.includes(v) &&
      v.match_score >= 0.50 &&
      v.ai_recommendation !== 'not_recommended' &&
      (channelCounts.get(v.video.channelId) || 0) < 2
    )
    .sort((a, b) => b.match_score - a.match_score);

  for (const v of remaining) {
    if (portfolio.length >= maxTotal) break;
    portfolio.push(v);
    channelCounts.set(v.video.channelId,
      (channelCounts.get(v.video.channelId) || 0) + 1);
  }

  return portfolio;
}
```

#### 5.2 Add `content_role` to `content_matches` DB upsert

When saving to `content_matches`, include the role. This requires a new nullable column:

```sql
ALTER TABLE content_matches ADD COLUMN content_role TEXT;
```

This is additive — existing rows get NULL, existing queries are unaffected.

---

### Phase 6: Front-End Enhancements (minimal, optional)

**Goal**: Surface the content role to instructors so they understand *why* each video was selected.

#### 6.1 Add role badge to content match display

In components that display content matches (`UnifiedLOCard.tsx`, `ContentCurationPanel.tsx`), if `content_role` is present on the match, show a small badge:
- "Tutorial" for `core_explainer`
- "Real-World Case" for `real_world_case`
- "Curiosity Spark" for `curiosity_spark`
- "Expert Perspective" for `practitioner_perspective`
- "Analysis" for `debate_or_analysis`
- "Related Insight" for `adjacent_insight`
- No badge if `content_role` is null (backward compatible)

This is purely additive UI — no existing behavior changes.

---

## Files Changed (by phase)

### Phase 1 (Content Role Reasoning)
- **NEW**: `supabase/functions/_shared/query-intelligence/reasoners/content-role-reasoner.ts`
- **NEW**: `supabase/functions/_shared/query-intelligence/builders/role-aware-builder.ts`
- **MODIFY**: `supabase/functions/_shared/query-intelligence/orchestrator.ts` — add role reasoning step, increase maxQueries
- **MODIFY**: `supabase/functions/_shared/query-intelligence/types.ts` — add ContentBrief, ContentRole types, content_role to GeneratedQuery

### Phase 2 (Content-Type-Aware Query Suffixing)
- **MODIFY**: `supabase/functions/search-youtube-content/index.ts` — search top 5 queries instead of 3, add content-type variants

### Phase 3 (Scoring Overhaul)
- **MODIFY**: `supabase/functions/search-youtube-content/index.ts` — replace `calculateChannelAuthorityScore`, revise `calculateDurationFitScore`, lower `MIN_DURATION_FIT`

### Phase 4 (AI Evaluation Prompt Redesign)
- **MODIFY**: `supabase/functions/evaluate-content-batch/index.ts` — add optional `content_roles` field, role-specific prompts, backward-compatible

### Phase 5 (Portfolio-Aware Selection)
- **MODIFY**: `supabase/functions/search-youtube-content/index.ts` — replace linear filtering with portfolio selection
- **DB MIGRATION**: Add `content_role` column to `content_matches` table

### Phase 6 (Front-End — optional)
- **MODIFY**: `src/components/instructor/UnifiedLOCard.tsx` — add role badge
- **MODIFY**: `src/components/instructor/ContentCurationPanel.tsx` — add role badge

## Files NOT Changed (dependency-safe)
- `src/hooks/useLearningObjectives.ts` — reads same response shape
- `src/hooks/useTeachingUnits.ts` — reads same response shape
- `src/services/content-service.ts` — calls same endpoint, same params
- `src/components/instructor/ManualContentSearch.tsx` — independent path
- `supabase/functions/add-instructor-content/` — calls evaluate-content-batch without content_roles (gets existing behavior)
- `supabase/functions/add-manual-content/` — same
- `supabase/functions/search-khan-academy/` — same
- `supabase/functions/search-educational-content/` — same
- `supabase/functions/_shared/youtube-search/*` — search sources unchanged
- `supabase/functions/_shared/content-cache.ts` — caching unchanged
- `supabase/functions/_shared/youtube-search/metadata-enricher.ts` — enrichment unchanged

## Risk Mitigation

1. **Content Role Reasoner LLM failure**: 5-second timeout + full fallback to existing query generation. Zero regression risk.
2. **evaluate-content-batch backward compatibility**: `content_roles` is optional. When absent, 100% existing behavior. Tested by the fact that 4 other edge functions call it without the new field.
3. **Database migration**: Single nullable column addition. No existing queries or indexes affected.
4. **Portfolio selection fallback**: When `contentBrief` is null (reasoner failed), falls back to current linear selection logic.
5. **Score threshold change**: `MIN_DURATION_FIT` lowered from 0.3 to 0.2, but unknown-duration videos now score 0.4+ so this is actually more permissive in a controlled way — the AI evaluation is the real quality gate.

## Execution Order

Phases 1-5 should be implemented in order (each depends on the previous). Phase 6 is independent and can be done anytime after Phase 5.

Within each phase, changes are atomic — partial implementation of a phase should not be deployed.
