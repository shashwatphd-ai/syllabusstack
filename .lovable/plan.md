

# Enable Image Generation for All Slides with Visual Directives

## Problem
The `slideNeedsImage()` function in `image-prompt-builder.ts` has a hardcoded `skipTypes` list that blocks image generation for `conclusion`, `recap`, `further_reading`, `title`, `title_slide`, `summary`, and `preview` slides -- even when Professor AI has written a `visual_directive` for them.

## Solution
Change the logic so that the `skipTypes` filter only applies when a slide has **no** `visual_directive`. If Professor AI explicitly wrote a visual directive, the slide should always get an image regardless of type.

### File: `supabase/functions/_shared/image-prompt-builder.ts`

**Current logic (line 158-173):**
```typescript
export function slideNeedsImage(slide: StoredSlide): boolean {
  if (slide.visual?.url) return false;

  const skipTypes = ['conclusion', 'recap', 'further_reading', 'title', 'title_slide', 'summary', 'preview'];
  if (skipTypes.includes(slide.type?.toLowerCase() || '')) return false;

  if (slide.visual_directive?.type && slide.visual_directive.type !== 'none') return true;
  if (slide.visual?.type && slide.visual.type !== 'none') return true;

  const c = slide.content || {};
  return !!(c.main_text || c.key_points?.length || c.steps?.length || c.definition);
}
```

**New logic:**
```typescript
export function slideNeedsImage(slide: StoredSlide): boolean {
  // Skip if already has image
  if (slide.visual?.url) return false;

  // If Professor AI wrote an explicit visual directive, ALWAYS generate
  if (slide.visual_directive?.type && slide.visual_directive.type !== 'none') return true;
  if (slide.visual_directive?.description) return true;

  // For slides WITHOUT a visual directive, skip non-content types
  const skipTypes = ['conclusion', 'recap', 'further_reading', 'title', 'title_slide', 'summary', 'preview'];
  if (skipTypes.includes(slide.type?.toLowerCase() || '')) return false;

  // Has visual with a type
  if (slide.visual?.type && slide.visual.type !== 'none') return true;

  // Has enough content to generate a meaningful visual
  const c = slide.content || {};
  return !!(c.main_text || c.key_points?.length || c.steps?.length || c.definition);
}
```

The key change: move the `visual_directive` checks **above** the `skipTypes` filter. This way, any slide where Professor AI explicitly requested a visual will get one, while slides with no directive and a non-content type are still skipped (avoiding blank/meaningless image generation).

## Post-Deploy: Re-populate Queue

After deploying, you will need to trigger "Generate Images" on each affected course to populate the queue with the newly-eligible slides. The existing slides already have `visual_directive` data persisted in the database, so the new filter will pick them up immediately.

## Impact

- **1 file changed**: `supabase/functions/_shared/image-prompt-builder.ts` (6 lines reordered)
- **No database changes**
- **No frontend changes**
- All three callers (`poll-active-batches`, `process-batch-images`, `buildImagePrompt`) use the same function, so the fix propagates everywhere automatically

