

# Fix: Widen Scroll Layout to Use Available Space

## Problem

The content container is capped at `max-w-3xl` (768px). On a typical 1400-1920px wide monitor, this wastes 40-60% of the screen. With the 280px image column, text gets squeezed to roughly 450px, cutting off bullet points and forcing unnecessary line wraps. The student sees a narrow column surrounded by empty space.

## Solution

Widen the content area and improve the side-by-side proportions so content fills the viewport naturally.

### Change in `src/components/slides/NarratedScrollViewer.tsx`

**1. Widen outer container** (line 213)

Change `max-w-3xl` to `max-w-5xl` (1024px). This gives ~65% more horizontal space while still keeping content readable and not stretching lines too wide for comfortable reading.

```text
Before:  max-w-3xl  (768px)  ->  text ~450px with image
After:   max-w-5xl  (1024px) ->  text ~700px with image
```

**2. Increase image column width** (line 272)

Change `sm:w-[280px]` to `sm:w-[320px]`. The extra width makes images more readable without dominating.

**3. Increase image max-height** (line 282)

Change `sm:max-h-[300px]` to `sm:max-h-[360px]` to let taller diagrams render without excessive cropping.

These are the ONLY changes -- three CSS values in one file. The layout remains a template that works for any course: `max-w-5xl` is a proportion, not a fixed pixel assumption, and `sm:w-[320px]` for images is a sensible default for generated visuals.

```text
New layout on a 1400px screen:

|--188px--|-------------- 1024px (max-w-5xl) --------------|--188px--|
|         | Text content (~680px)  |  Image (320px)        |         |
|  empty  | Paragraphs, bullets,   |  Sticky diagram       |  empty  |
|         | definitions fill here  |  or chart              |         |
```

## What Does NOT Change

- Mobile layout (stacked, already full-width with padding)
- Auto-scroll sync logic (handled by programmaticScrollRef from previous fix)
- Classic slides mode
- Any backend code
- Section dividers, typography sizes, highlight behavior

## File Modified

| File | Change |
|------|--------|
| `src/components/slides/NarratedScrollViewer.tsx` | Line 213: `max-w-3xl` to `max-w-5xl`; Line 272: `sm:w-[280px]` to `sm:w-[320px]`; Line 282: `sm:max-h-[300px]` to `sm:max-h-[360px]` |

