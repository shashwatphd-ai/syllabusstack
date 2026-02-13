

# Adaptive Image Generation: Let Content Drive the Visual

## Summary

Two string constants need updating across two files. No structural, schema, or pipeline changes. The data flow is already correct -- `serializeSlideContext()` already passes all slide content (type, title, main_text, definition, example, misconception, steps, speaker_notes, visual description, elements, educational_purpose, domain) to the prompt writer LLM. The prompt writer just needs permission to use that context intelligently instead of following a rigid format lookup table.

## What's Actually Happening Now (Verified)

The context pipeline works correctly:

```text
Professor AI generates slide with visual_directive
    |
    v
Save step maps visual_directive.description --> visual.fallback_description
    |
    v
buildImagePrompt() calls serializeSlideContext()
    |
    v
serializeSlideContext() reads visual.fallback_description, elements, style,
educational_purpose, content.main_text, definition, example, misconception,
steps, speaker_notes, slide type, lecture title, domain
    |
    v
All of this is sent to the Prompt Writer LLM as structured text
    |
    v
Prompt Writer LLM generates image prompt... BUT is forced to output
"A horizontal flowchart..." / "A radial diagram..." because of rigid
format templates in IMAGE_PROMPT_WRITER_SYSTEM
    |
    v
Image model receives prompt... BUT its system instruction forces
"flat design", "infographic-style diagram", "no stock-photo elements"
```

The intelligence is there. The content is there. Two hardcoded prompts are blocking it.

## What Changes

### File 1: `supabase/functions/_shared/image-prompt-builder.ts`

**Replace the `IMAGE_PROMPT_WRITER_SYSTEM` constant.**

Remove:
- The rigid type-to-format lookup table ("process" = "numbered step boxes connected by arrows")
- Forced style endings ("Clean infographic style, white background, professional academic design.")
- Three hardcoded domain-to-metaphor mappings (business/science/ethics only)
- "Style: clean infographic, NOT clipart or stock icons"

Replace with instructions that tell the prompt writer LLM to:
- Read all the context fields it receives (visual description, content, domain, slide type, speaker notes)
- Let the visual description from Professor AI be the primary signal for what to depict
- Choose the format that best represents the actual content (diagram for frameworks, realistic scene for case studies, rendered equation for math, graph for data, faithful reproduction for known models like Porter's Five Forces or SWOT)
- Keep generation-quality constraints: max 6 text labels, short, spelled correctly, spatial precision
- No forced opening ("A horizontal flowchart...") or closing lines

**Update `buildFallbackPrompt` style hints:**
- Change `'clean infographic style, white background'` to `'professional academic visual, clear and well-composed'`
- Change the type-specific hints similarly (no longer forcing "flowchart" or "panel layout")

### File 2: `supabase/functions/_shared/unified-ai-client.ts`

**Replace the system prompt string at line 413 (OpenRouter) and line 625 (Google).**

Current (both locations):
```
You are an educational diagram generator for university lecture slides. Generate a single
clean, professional infographic-style diagram on a white background. The image must be
visually clear at presentation scale (1920x1080). All text labels in the image must be
spelled correctly and placed inside shapes. Use flat design with meaningful colors.
Do not include decorative borders, watermarks, or stock-photo elements.
```

New (both locations):
```
You are an educational visual generator for university lecture slides. Generate a single
high-quality image that accurately represents the described concept. The image must be
visually clear at presentation scale (1920x1080). If the description calls for a diagram,
render clean labeled shapes. If it describes a real-world scene, render it realistically.
If it describes a graph or equation, render it precisely. All text in the image must be
spelled correctly and legible. Do not include decorative borders or watermarks.
```

Removes the three constraints that lock output to flat infographics:
- "infographic-style diagram" -- gone
- "flat design" -- gone
- "no stock-photo elements" -- gone

Keeps the constraints that matter for quality:
- 1920x1080 clarity
- Correct spelling
- No borders/watermarks

## What Does NOT Change

| Component | Why |
|-----------|-----|
| `serializeSlideContext()` | Already passes all context correctly |
| `buildImagePrompt()` function logic | Unchanged -- calls LLM, validates length, falls back |
| `slideNeedsImage()` | Unchanged |
| Professor AI prompt | Unchanged |
| Image model selection (gemini-3-pro-image-preview) | Unchanged |
| Image generation routing (Google/OpenRouter) | Unchanged |
| Queue system (image_generation_queue) | Unchanged |
| Storage upload | Unchanged |
| Retry/fallback logic | Unchanged |
| Rate limiting | Unchanged |
| Database schema | No changes |
| Frontend | No changes |
| `process-batch-images` worker | Unchanged |
| `poll-active-batches` queuing | Unchanged |

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/_shared/image-prompt-builder.ts` | Replace `IMAGE_PROMPT_WRITER_SYSTEM` string; update 4 style hint strings in `buildFallbackPrompt` |
| `supabase/functions/_shared/unified-ai-client.ts` | Replace system prompt string at line 413 and line 625 (identical change, two locations) |

## Risk Assessment

- **Zero pipeline risk**: Only string constants change; no function signatures, no data flow, no schema
- **Text legibility**: Realistic scenes may make embedded text harder to read -- mitigated by keeping the "max 6 labels, short, spelled correctly, legible" constraint in the prompt writer
- **Cost/latency**: Zero change -- same models, same token counts, same pipeline
- **Existing images**: Unaffected -- stored images remain as-is; only new generations use updated prompts
- **Queue items already stored**: Their prompts are already persisted; unaffected by this change
