

# Fix: False "Audio Outdated" Warning

## Root Cause

The `updated_at` column is a Postgres auto-trigger that fires on **every** row update, including when the audio generation function itself writes `has_audio`, `audio_status`, and `audio_generated_at`. This means `updated_at` is always a few minutes newer than `audio_generated_at`, causing the comparison to always return "outdated."

```text
Timeline for slide 6d91ce30:
  03:55:00  Audio generation starts -> UPDATE audio_status='generating' -> updated_at bumps
  03:58:58  Audio finishes -> UPDATE audio_generated_at='03:58:58', has_audio=true -> updated_at bumps to 04:02:12

  Result: updated_at (04:02) > audio_generated_at (03:58) -> FALSE POSITIVE "outdated"
```

## Fix: Add a `slides_updated_at` column

Add a dedicated timestamp that ONLY changes when slide content actually changes, not when audio metadata is written.

### Step 1: Database migration

Add a `slides_updated_at` column to `lecture_slides`:

```sql
ALTER TABLE lecture_slides ADD COLUMN slides_updated_at timestamptz DEFAULT now();
```

### Step 2: Update slide generation to set `slides_updated_at`

**File: `supabase/functions/generate-lecture-slides-v3/index.ts`**

When slides are generated or regenerated, set `slides_updated_at: new Date().toISOString()` alongside the slides data. This marks the moment the actual content changed.

### Step 3: Do NOT set `slides_updated_at` in audio generation

**File: `supabase/functions/generate-lecture-audio/index.ts`**

No changes needed here -- the audio function already doesn't touch this new column, so it won't bump it. Only slide content changes will update `slides_updated_at`.

### Step 4: Fix the staleness check in the UI

**File: `src/components/slides/LectureSlideViewer.tsx`**

Change the comparison from:
```typescript
return new Date(lectureSlide.updated_at) > new Date(lectureSlide.audio_generated_at);
```
to:
```typescript
return new Date(lectureSlide.slides_updated_at) > new Date(lectureSlide.audio_generated_at);
```

### Step 5: Backfill existing data

Set `slides_updated_at` to a safe default for existing rows so the warning doesn't trigger falsely on old data:

```sql
UPDATE lecture_slides SET slides_updated_at = COALESCE(audio_generated_at, created_at);
```

This ensures existing slides with audio won't show the false warning.

## Summary

| What | Before | After |
|---|---|---|
| Staleness comparison | Uses `updated_at` (bumped by ALL writes) | Uses `slides_updated_at` (only bumped by content changes) |
| Audio generation writes | Bump `updated_at` causing false positive | Don't touch `slides_updated_at` |
| Slide regeneration | Only bumps generic `updated_at` | Sets `slides_updated_at` explicitly |

