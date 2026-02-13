

# CMM Post-Processing Step for Speaker Notes

## Approach

Instead of modifying the Professor AI system prompt (which degraded image quality by changing how the AI reasons about ALL slide content), add a dedicated post-processing step that runs after Professor AI generates slides but before they are saved. This step takes each slide's generic speaker notes and transforms them into CMM-quality conversational narration using the existing `ai-narrator.ts` module.

## Why This Is Better

- Professor AI prompt stays unchanged -- visual directives and slide content quality remain exactly as they were
- Image generation receives the same quality input as before
- Speaker notes get the full CMM treatment (Zero-to-Expert arc, analogies, citation stripping, cross-slide continuity)
- The same CMM logic runs consistently in both individual (v3) and batch paths

## What Changes

### File 1: `supabase/functions/_shared/ai-narrator.ts`

**Add a new exported function `upgradeSpeakerNotes()`** that takes an array of generated slides and runs the CMM narrator on each one sequentially (to preserve cross-slide continuity via the rolling 100-word tail).

```typescript
export async function upgradeSpeakerNotes(
  slides: Array<{ order: number; type: string; title: string; content: any; speaker_notes: string }>,
  unitTitle: string,
  domain: string
): Promise<void>
```

This function:
1. Iterates through slides in order
2. For each slide, calls `generateNarration()` with the full CMM system prompt
3. Passes the existing generic speaker notes as "raw material" (the CMM prompt already handles this via the `EXISTING NOTES` section)
4. Maintains the rolling `previousNarrationTail` for cross-slide continuity
5. Overwrites `slide.speaker_notes` in place with the CMM-quality narration
6. Includes error handling -- if CMM upgrade fails for a slide, keeps the original generic notes

**Also update `needsNarration()`** -- currently it skips notes longer than 50 chars. The new `upgradeSpeakerNotes` function will bypass this check since it always upgrades, regardless of length.

### File 2: `supabase/functions/generate-lecture-slides-v3/index.ts`

**Add CMM post-processing step between Phase 2C (Professor AI) and Phase 3 (Save).**

After `runProfessorAI()` returns slides (around line 225), insert:

```
// PHASE 2D: CMM Speaker Notes Upgrade
await updateProgress(supabase, slideRecordId, 'narration', 55, 'Upgrading speaker notes with Conversational Mastery Method...');
await upgradeSpeakerNotes(slides, context.title, context.domain);
```

This runs before slides are saved, so the database always contains CMM-quality notes. Progress tracking shows users this step is happening.

### File 3: `supabase/functions/process-batch-research/index.ts`

**Add the same CMM post-processing step in the batch pipeline.**

After slides are parsed from the AI response in `processBatchViaOpenRouter()` (or `processVertexBatchResults()`), call `upgradeSpeakerNotes()` on each unit's slides before saving to the database.

This ensures batch-generated slides get identical CMM treatment.

## What Does NOT Change

| Component | Status |
|-----------|--------|
| `PROFESSOR_SYSTEM_PROMPT` in slide-prompts.ts | Unchanged -- keeps "200-300 words" generic instruction |
| `buildUserPrompt()` in slide-prompts.ts | Unchanged |
| `buildPromptForUnit()` in process-batch-research | Unchanged |
| Image prompt builder (`image-prompt-builder.ts`) | Unchanged |
| Image generation pipeline | Unchanged |
| Visual directive quality | Restored to previous quality |
| `CMM_SYSTEM_PROMPT` in ai-narrator.ts | Unchanged -- reused as-is |
| `generateNarration()` in ai-narrator.ts | Unchanged -- called by new wrapper |
| Audio generation pipeline | Unchanged -- reads notes verbatim via TTS |
| Database schema | No changes |
| Frontend | No changes |

## Pipeline After This Change

```text
Phase 1: Context Gathering (unchanged)
Phase 2: Research Agent (unchanged)  
Phase 2C: Professor AI --> generic slides with 200-300 word notes + high-quality visual directives
Phase 2D: CMM Upgrade --> each slide's speaker_notes transformed to 200-350 word CMM narration  [NEW]
Phase 3: Save slides (now with CMM notes) + queue images (visual directives unchanged)
Phase 4: Async image generation (unchanged, receives same quality input as before)

Audio Generation (later):
  needsNarration() = FALSE (notes are 200+ words, CMM quality)
  TTS reads notes verbatim --> perfectly synced audio
```

## Cost and Latency Impact

- Adds 6 sequential LLM calls per teaching unit (one per slide) using `gemini-3-flash-preview`
- Estimated ~8-12 seconds additional latency per unit
- Cost: ~$0.003 per unit (6 x ~500 input tokens + ~400 output tokens at Flash pricing)
- The cross-slide continuity requires sequential processing (each slide needs the previous one's tail)

