

# Revised Plan: Slide Generation Pipeline Quality Optimization

## Review Acknowledgment

The original plan was reviewed and found to have several issues:
- **Overstated problems** (the research query isn't "generic" — it already uses trusted_sites, avoid_sources, etc.)
- **Token budget explosion** (~1500 tokens added would balloon system prompt from ~2500 to ~4000)
- **Fragile regex-based implementations** that will have false positives/negatives
- **Missing action paths** for quality check failures
- **SELF-TEST section** that doesn't work (LLMs generate in a single pass, they don't "go back and delete")

This revised plan implements at **~60% of original scope** with higher confidence of success.

---

## Implementation Priority Order

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        REVISED IMPLEMENTATION ORDER                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  1. TEMPERATURE (1 line change, immediate impact)                                   │
│     └── 0.7 → 0.4 for factual educational content                                  │
│                                                                                     │
│  2. ANTI-PATTERN BAN (~200 tokens, condensed)                                       │
│     └── 6 patterns, 1 BAD example each, NO rewrites, NO SELF-TEST                  │
│                                                                                     │
│  3. FEW-SHOT EXAMPLES (3 focused examples only)                                     │
│     └── main_text, misconception block, visual_directive                            │
│     └── Calibrated to slide density, not essay density                              │
│                                                                                     │
│  4. QUALITY METRICS (logging only, not a gate)                                      │
│     └── Score calculation + console warnings                                        │
│     └── NO auto-retry, NO blocking — just visibility                               │
│                                                                                     │
│  DEFERRED:                                                                          │
│  ✗ Research query rewrite (current query is adequate, incremental improvements)    │
│  ✗ Semantic merge categorization (needs LLM classification, not regex)              │
│  ✗ Visual directive post-hoc enrichment (prompt improvements handle this)           │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Change 1: Temperature Calibration

**File:** `supabase/functions/generate-lecture-slides-v3/index.ts`
**Line:** 946

### Rationale
- Current: 0.7 (introduces unnecessary creativity, hallucination risk for factual content)
- Research Agent already uses 0.3 — inconsistency in the pipeline
- 0.4 balances consistency with natural variation

### Implementation

```typescript
// Line 946 - BEFORE:
temperature: 0.7,

// Line 946 - AFTER:
temperature: 0.4,  // Factual educational content benefits from lower temperature
```

**Risk:** Low. One-line change, easy to revert if quality degrades.
**Testing:** A/B test 0.4 vs 0.5 vs 0.7 on same topic to measure consistency.

---

## Change 2: Condensed Anti-Pattern Ban

**File:** `supabase/functions/generate-lecture-slides-v3/index.ts`
**Location:** Insert after line 694 (after "NO filler content—every sentence must teach something")

### Rationale
- Original proposal: ~600 tokens with REWRITE examples and SELF-TEST section
- Revised: ~200 tokens, pattern name + 1 BAD example each
- REWRITEs belong in few-shot examples (Change 3), not here
- SELF-TEST removed — LLMs generate in single pass, can't "go back and delete"

### Implementation

Add this section to `PROFESSOR_SYSTEM_PROMPT` after line 694:

```text
BANNED RHETORICAL PATTERNS (hollow content that sounds profound but teaches nothing):

1. CONTRAST FRAMING: "This isn't about tools. It's about mindset."
   → Delete and rewrite with specifics: WHAT about mindset? HOW does it differ?

2. SYNTHETIC REPETITION: "Clarity matters. Precision matters. Intent matters."
   → Delete: three synonyms, zero new information.

3. TRIADIC CLOSURE: "People. Process. Technology."
   → Delete: three nouns without explanation. What ABOUT them?

4. DECLARATIVE AUTHORITY: "AI is reshaping the future of work."
   → Delete: unfalsifiable. Which AI? Which work? How? When?

5. PERFORMATIVE VULNERABILITY: "I used to think this way. I was wrong."
   → Delete: borrows credibility without contributing detail.

6. DISCOMFORT SIGNALING: "Here's an uncomfortable truth..."
   → Delete: the framing carries weight the argument hasn't earned.

If you catch yourself using these patterns, the sentence is carrying no educational weight.
State claims with specifics, evidence, and mechanisms instead.
```

**Token estimate:** ~180 tokens (vs ~600 in original proposal)
**Risk:** Low. Additive instruction, doesn't break existing flow.

---

## Change 3: Focused Few-Shot Examples

**File:** `supabase/functions/generate-lecture-slides-v3/index.ts`
**Location:** Insert after Change 2 (still within `PROFESSOR_SYSTEM_PROMPT`)

### Rationale
- Original proposal: 7 example pairs (BAD/GOOD for main_text, key_points, misconception, visual)
- Research shows diminishing returns past 2-3 examples
- Original GOOD examples modeled essay density, not slide density
- Revised: 3 examples calibrated to actual slide constraints

### Implementation

Add after the anti-pattern section:

```text
QUALITY REFERENCE EXAMPLES:

=== main_text (50-80 words, not essay-length) ===
BAD: "Leadership is important for organizations. It helps teams succeed."
GOOD: "Teams with highly engaged leaders outperform peers by 147% in earnings per share, according to Gallup's 2023 State of the Workplace report [Source 1]. The mechanism is psychological safety—when team members can take risks without fear of punishment, problems surface earlier and solutions emerge faster."

=== misconception block (structured, evidence-based) ===
BAD: { "wrong_belief": "Communication is easy", "why_wrong": "It's hard", "correct_understanding": "Do it right" }
GOOD: {
  "wrong_belief": "Managers believe sending a well-crafted email constitutes 'communication.' Once sent, job done.",
  "why_wrong": "Communication isn't 'received' because it was 'sent.' Sull et al. (2015) found strategic messages lose 50-80% of meaning through organizational layers—the 'resemblance gap' [Source 2].",
  "correct_understanding": "Effective communication requires: (1) multi-channel delivery, (2) feedback to confirm understanding ('explain this to a new hire'), (3) contextual relevance for each team's daily work."
}

=== visual_directive (50+ words, domain-specific elements) ===
BAD: { "description": "A diagram showing communication", "elements": ["people", "arrows"] }
GOOD: { "description": "Vertical flowchart: 'Strategy Communication Cascade.' Top box 'Executive Vision' (100% message fidelity). Three arrows down to 'Division Translation' (70%), 'Team Contextualization' (45%), 'Individual Action' (23%). Right side: orange 'Feedback Loop' arrow pointing up with checkpoints 'Comprehension Check', 'Barrier Identification', 'Adaptation Signal'.", "elements": ["Executive Vision box", "Division/Team/Individual boxes with % labels", "Feedback Loop arrow with 3 checkpoints"], "educational_purpose": "Visualize message degradation through organizational layers" }
```

**Token estimate:** ~350 tokens
**Total prompt increase:** ~530 tokens (Change 2 + Change 3)
**Risk:** Medium. Examples may not perfectly match all domains. Monitor for over-fitting to management/strategy topics.

---

## Change 4: Quality Metrics Logging (Not a Gate)

**File:** `supabase/functions/generate-lecture-slides-v3/index.ts`
**Location:** Replace lines 1177-1185 (current simplistic quality score)

### Rationale
- Original proposal defined quality checks but no action path for failures
- Implementing as a gate requires retry logic, fallback content, etc.
- First step: visibility through logging and improved scoring
- Future: add retry policy after analyzing failure patterns

### Implementation

Replace current quality scoring (lines 1177-1185) with:

```typescript
// Quality metrics calculation (logging only, not a gate)
function calculateQualityMetrics(slides: ProfessorSlide[]): {
  score: number;
  metrics: Record<string, number>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const metrics: Record<string, number> = {
    avgMainTextWords: 0,
    avgSpeakerNotesWords: 0,
    avgKeyPointsPerSlide: 0,
    citationCount: 0,
    slidesWithMisconception: 0,
    slidesWithDefinition: 0,
    shortVisualDescriptions: 0,
  };

  let totalMainTextWords = 0;
  let totalSpeakerNotesWords = 0;
  let totalKeyPoints = 0;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const slideLabel = `Slide ${i + 1} (${slide.type})`;

    // Main text length
    const mainTextWords = (slide.content?.main_text || '').split(/\s+/).filter(Boolean).length;
    totalMainTextWords += mainTextWords;
    if (mainTextWords < 30) {
      warnings.push(`${slideLabel}: main_text only ${mainTextWords} words (target: 50+)`);
    }

    // Speaker notes length
    const speakerNotesWords = (slide.speaker_notes || '').split(/\s+/).filter(Boolean).length;
    totalSpeakerNotesWords += speakerNotesWords;
    if (speakerNotesWords < 150) {
      warnings.push(`${slideLabel}: speaker_notes only ${speakerNotesWords} words (target: 200+)`);
    }

    // Key points count
    const keyPointsCount = slide.content?.key_points?.length || 0;
    totalKeyPoints += keyPointsCount;

    // Visual directive length
    const visualDescWords = (slide.visual_directive?.description || '').split(/\s+/).filter(Boolean).length;
    if (slide.visual_directive?.type && slide.visual_directive.type !== 'none' && visualDescWords < 50) {
      metrics.shortVisualDescriptions++;
      warnings.push(`${slideLabel}: visual description only ${visualDescWords} words (target: 50+)`);
    }

    // Misconception/definition presence
    if (slide.content?.misconception) metrics.slidesWithMisconception++;
    if (slide.content?.definition) metrics.slidesWithDefinition++;

    // Check for N/A placeholders
    const jsonStr = JSON.stringify(slide.content);
    if (jsonStr.includes('"N/A"') || jsonStr.includes('"Not applicable"') || jsonStr.includes('"n/a"')) {
      warnings.push(`${slideLabel}: Contains N/A placeholder`);
    }
  }

  // Citation count across all content
  const allContent = slides.map(s => JSON.stringify(s.content)).join(' ');
  const citationMatches = allContent.match(/\[Source \d+\]/g) || [];
  metrics.citationCount = citationMatches.length;

  // Calculate averages
  metrics.avgMainTextWords = Math.round(totalMainTextWords / slides.length);
  metrics.avgSpeakerNotesWords = Math.round(totalSpeakerNotesWords / slides.length);
  metrics.avgKeyPointsPerSlide = Math.round((totalKeyPoints / slides.length) * 10) / 10;

  // Score calculation (improved from current simplistic version)
  let score = 70; // Base score

  // Content depth bonuses
  if (metrics.avgMainTextWords >= 50) score += 5;
  if (metrics.avgSpeakerNotesWords >= 200) score += 10;
  if (metrics.avgKeyPointsPerSlide >= 3) score += 5;

  // Structure bonuses
  if (metrics.slidesWithMisconception > 0) score += 5;
  if (metrics.slidesWithDefinition > 0) score += 5;

  // Citation bonus
  if (metrics.citationCount >= 3) score += 5;

  // Penalties
  score -= warnings.length * 2; // 2 points per warning

  return {
    score: Math.max(0, Math.min(100, score)),
    metrics,
    warnings,
  };
}
```

Then update the usage (around line 1177):

```typescript
// Calculate quality metrics with detailed logging
const qualityResult = calculateQualityMetrics(initialSlides);
const qualityScore = qualityResult.score;

console.log('[Main] Quality metrics:', JSON.stringify(qualityResult.metrics));
if (qualityResult.warnings.length > 0) {
  console.warn(`[Main] Quality warnings (${qualityResult.warnings.length}):`, 
    qualityResult.warnings.slice(0, 5).join('; '));
}
```

**Risk:** Low. Logging-only, no blocking behavior.
**Future:** After analyzing warning patterns across 50+ generations, define retry policy.

---

## Deferred Changes (With Rationale)

### Research Query Rewrite — DEFERRED
**Reviewer's point:** The current query already uses `trusted_sites`, `avoid_sources`, `academic_level`, `core_concept`, and `what_to_teach`. It's not "generic."

**What's deferred:** Full rewrite with priority ordering.
**What to do incrementally:** Add freshness constraint ("prefer post-2020 sources unless seminal").

### Semantic Research Merge — DEFERRED
**Reviewer's point:** Regex-based categorization is brittle. A claim like "The company studied the effect of..." matches both `examples` (contains "company") and `statistics` (contains "study").

**Proper solution:** Either:
1. Modify the Perplexity query to request categorized output, OR
2. Use a lightweight LLM classification pass on returned claims

Both require additional design work. Defer until quality metrics (Change 4) reveal this is actually causing problems.

### Visual Directive Post-Enrichment — DROPPED
**Reviewer's point:** Post-hoc enrichment by concatenating title + main_text snippet doesn't produce good descriptions—it produces vaguely contextualized prompts.

**Better approach:** The few-shot example in Change 3 shows what good visual directives look like. If Professor AI still produces bad ones, the fix is in the prompt, not post-processing.

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `supabase/functions/generate-lecture-slides-v3/index.ts` | 946 | Temperature 0.7 → 0.4 |
| `supabase/functions/generate-lecture-slides-v3/index.ts` | After 694 | Add ~200 token anti-pattern section |
| `supabase/functions/generate-lecture-slides-v3/index.ts` | After anti-patterns | Add ~350 token few-shot examples |
| `supabase/functions/generate-lecture-slides-v3/index.ts` | 1177-1185 | Replace quality scoring with detailed metrics function |

---

## Token Budget Analysis

| Component | Current | After Changes |
|-----------|---------|---------------|
| System prompt | ~2,500 tokens | ~3,030 tokens (+530) |
| User prompt | ~1,500 tokens | ~1,500 tokens (unchanged) |
| Total prompt | ~4,000 tokens | ~4,530 tokens (+13%) |

**Cost impact:** At $0.10/1M input tokens (Gemini 3 Flash), 530 extra tokens = $0.000053 per generation. Negligible.

---

## Testing Plan

1. **Temperature A/B Test**
   - Generate same topic 3x at 0.4, 0.5, and 0.7
   - Compare consistency and hallucination frequency

2. **Anti-Pattern Detection (Manual)**
   - Generate 10 slide decks across different domains
   - Grep output for banned patterns
   - Track reduction rate vs baseline

3. **Quality Metrics Baseline**
   - Run 20 generations with new metrics logging
   - Analyze warning frequency by type
   - Identify if any single issue dominates (e.g., short speaker notes)

4. **Few-Shot Effectiveness**
   - Compare main_text word counts before/after
   - Compare misconception block depth before/after
   - Verify visual descriptions meet 50-word threshold

---

## Success Criteria

| Metric | Current Baseline | Target |
|--------|------------------|--------|
| Avg main_text words | ~40 (estimated) | 50+ |
| Avg speaker_notes words | ~180 (estimated) | 200+ |
| N/A placeholder rate | Unknown | 0% |
| Citation usage | ~2 per deck | 5+ per deck |
| Visual descriptions <50 words | Unknown | <10% of slides |

---

## Summary

This revised plan implements **4 focused changes** instead of 7 broad ones:

1. **Temperature:** 0.7 → 0.4 (1 line)
2. **Anti-patterns:** Condensed to ~200 tokens (vs 600+)
3. **Few-shot examples:** 3 focused examples (vs 7 pairs)
4. **Quality metrics:** Logging only (vs undefined gate)

Total token increase: +530 (vs +1500 in original plan)
Risk level: Low to Medium (vs High in original plan)
Implementation time: ~2 hours (vs ~6 hours for full plan)

Deferred changes will be reconsidered after collecting quality metrics data from 50+ generations.

