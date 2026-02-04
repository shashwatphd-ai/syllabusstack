
# Fix Citation Rendering System

## Problem Summary

Slide content contains `[Source N]` markers (e.g., `[Source 6]`) that should render as clickable links to actual sources, but they currently appear as raw text.

**Current Flow:**
```text
Research Agent → grounded_content[{claim, source_url, source_title}]
       ↓
Prompt Injection → "[Source 1] = claim 1, [Source 2] = claim 2..."
       ↓
Professor AI → Embeds [Source N] markers in slide text
       ↓
Database → Slides saved WITH markers, research_context saved separately
       ↓
Frontend → Renders [Source N] as literal text (BUG)
```

**Evidence from Database:**
- `main_text`: "...beyond a firm's direct control but significantly impact its long-term viability [Source 6]."
- `research_context.grounded_content[5]`: Contains `source_url: "https://openstax.org/..."`
- But no mapping exists between `[Source 6]` and `grounded_content[5]`

---

## Solution Architecture

### Two-Phase Fix (Frontend + Backend Enhancement)

**Phase 1: Frontend Citation Renderer (Immediate Fix)**
Create a utility that parses `[Source N]` markers and renders them as clickable tooltips/links using the `research_context.grounded_content` array from the lecture slide record.

**Phase 2: Backend Citation Embedding (Robust Fix)**  
Update the slide generation to embed the actual citation objects per-slide, making the system self-contained and portable.

---

## Phase 1: Frontend Citation Renderer

### File: `src/lib/citationParser.ts` (NEW)

Utility to parse text containing `[Source N]` markers:

```typescript
interface Citation {
  claim: string;
  source_url: string;
  source_title: string;
  confidence?: number;
}

interface ParsedTextSegment {
  type: 'text' | 'citation';
  content: string;
  citation?: Citation;
  sourceIndex?: number;
}

export function parseTextWithCitations(
  text: string,
  citations: Citation[] = []
): ParsedTextSegment[] {
  const segments: ParsedTextSegment[] = [];
  const regex = /\[Source (\d+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the citation
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add citation segment
    const sourceIndex = parseInt(match[1], 10) - 1; // Convert to 0-indexed
    const citation = citations[sourceIndex];
    
    segments.push({
      type: 'citation',
      content: match[0],
      sourceIndex: sourceIndex + 1,
      citation: citation || undefined,
    });

    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last citation
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
```

### File: `src/components/slides/CitationText.tsx` (NEW)

Component to render text with inline clickable citations:

```typescript
interface CitationTextProps {
  text: string;
  citations: Citation[];
  className?: string;
}

export function CitationText({ text, citations, className }: CitationTextProps) {
  const segments = parseTextWithCitations(text, citations);
  
  return (
    <span className={className}>
      {segments.map((segment, i) => {
        if (segment.type === 'text') {
          return <span key={i}>{segment.content}</span>;
        }
        
        // Citation segment - render as tooltip/link
        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <a
                href={segment.citation?.source_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium cursor-pointer"
                onClick={(e) => {
                  if (!segment.citation?.source_url) {
                    e.preventDefault();
                  }
                }}
              >
                [{segment.sourceIndex}]
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {segment.citation ? (
                <div className="text-xs">
                  <p className="font-medium">{segment.citation.source_title}</p>
                  <p className="text-muted-foreground mt-1 line-clamp-2">
                    {segment.citation.claim}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Source not found</p>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
```

### File: `src/components/slides/SlideRenderer.tsx` (UPDATE)

Pass citations to text rendering and use `CitationText`:

**Changes needed:**
1. Accept `citations` prop from parent (fetched from `research_context.grounded_content`)
2. Replace direct text rendering with `<CitationText>` for:
   - `main_text`
   - `key_points` items
   - `definition.formal_definition` / `simple_explanation`
   - `example.scenario` / `walkthrough`
   - `misconception.wrong_belief` / `why_wrong` / `correct_understanding`

### File: `src/components/slides/StudentSlideViewer.tsx` (UPDATE)

Extract `grounded_content` from `research_context` and pass to `SlideRenderer`:

```typescript
// Extract citations from research_context
const citations = useMemo(() => {
  return lectureSlide.research_context?.grounded_content || [];
}, [lectureSlide.research_context]);

// Pass to SlideRenderer
<SlideRenderer
  slide={currentSlide}
  citations={citations}
  // ... other props
/>
```

---

## Phase 2: Backend Citation Embedding (Optional Enhancement)

For a more robust solution, the backend should map citations per-slide:

### File: `supabase/functions/generate-lecture-slides-v3/index.ts`

**Enhancement to `initialSlides` mapping (around line 1119):**

```typescript
// After generating slides, extract citation references and map them
const initialSlides = slides.map(slide => {
  // Extract [Source N] markers from all text content
  const textContent = [
    slide.content?.main_text || '',
    ...(slide.content?.key_points || []).map(kp => typeof kp === 'string' ? kp : kp.text),
    slide.content?.definition?.formal_definition || '',
    slide.content?.example?.scenario || '',
    slide.content?.misconception?.wrong_belief || '',
  ].join(' ');

  // Find all source references
  const sourceMatches = textContent.matchAll(/\[Source (\d+)\]/g);
  const usedCitations = [];
  
  for (const match of sourceMatches) {
    const index = parseInt(match[1], 10) - 1;
    if (researchContext.grounded_content[index]) {
      usedCitations.push({
        marker: `[Source ${index + 1}]`,
        ...researchContext.grounded_content[index],
      });
    }
  }

  return {
    // ... existing slide fields
    citations: usedCitations.length > 0 ? usedCitations : undefined,
  };
});
```

This makes each slide self-contained with its own citations array.

---

## Summary of Changes

| Component | File | Change |
|-----------|------|--------|
| Citation Parser | `src/lib/citationParser.ts` | NEW: Utility to parse `[Source N]` markers |
| Citation Renderer | `src/components/slides/CitationText.tsx` | NEW: Component with tooltips and links |
| Slide Renderer | `src/components/slides/SlideRenderer.tsx` | UPDATE: Use CitationText for all text fields |
| Student Viewer | `src/components/slides/StudentSlideViewer.tsx` | UPDATE: Extract and pass citations |
| Instructor Viewer | `src/components/slides/instructor/SlidePreview.tsx` | UPDATE: Extract and pass citations |
| Type Definitions | `src/hooks/lectureSlides/types.ts` | UPDATE: Add `citations` to ProfessorSlide interface |
| Backend (Optional) | `generate-lecture-slides-v3/index.ts` | ENHANCE: Embed citations per-slide |

---

## Technical Details

### Citation Index Mapping

The research context uses 0-indexed arrays, but the AI generates 1-indexed markers:
- `[Source 1]` maps to `grounded_content[0]`
- `[Source 6]` maps to `grounded_content[5]`

### Edge Cases to Handle

1. **Missing citation**: If `[Source 10]` references an index that doesn't exist, show "Source not available"
2. **No research context**: If `research_context` is null/empty, render markers as plain text
3. **Malformed markers**: Gracefully ignore markers that don't match the pattern

### Tooltip Content

Each citation tooltip shows:
- **Title**: `source_title` (e.g., "openstax.org")
- **Claim excerpt**: First 100 chars of `claim`
- **Link**: Opens `source_url` in new tab

---

## Testing Plan

After implementation:
1. Open any existing slide deck with `[Source N]` markers
2. Verify markers render as clickable `[N]` badges
3. Hover to see tooltip with source title and claim preview
4. Click to open source URL in new tab
5. Verify works for all text fields (main_text, key_points, definitions, examples, misconceptions)
6. Test with slides that have no research context (should render as plain text)
