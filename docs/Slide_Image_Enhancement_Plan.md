# Lecture Slide Image Enhancement Implementation Plan

## Overview
Combine three approaches to improve image visibility in lecture slides:
- **Option A**: Click-to-Expand Lightbox
- **Option B**: Responsive Stacked Layout
- **Option C**: View Mode Toggle

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SLIDE VIEWING SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐         ┌─────────────────────────────────┐    │
│  │   LectureSlideViewer    │         │     StudentSlideViewer          │    │
│  │   (Instructor View)     │         │     (Student View)              │    │
│  ├─────────────────────────┤         ├─────────────────────────────────┤    │
│  │ + viewMode state        │         │ + viewMode state                │    │
│  │ + ViewModeToggle button │         │ + ViewModeToggle button         │    │
│  └───────────┬─────────────┘         └───────────────┬─────────────────┘    │
│              │                                       │                       │
│              └───────────────┬───────────────────────┘                       │
│                              │                                               │
│                              ▼                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        SlideRenderer.tsx                               │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │  Props (all optional, backward compatible):                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ viewMode?: 'text-focus' | 'image-focus'  (default: 'text-focus')│  │  │
│  │  │ onImageClick?: (imageUrl: string) => void                       │  │  │
│  │  │ enableLightbox?: boolean (default: true)                        │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │  Layout Logic:                                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ Mobile/Tablet (<768px):                                         │  │  │
│  │  │   → ALWAYS stacked layout (text first, then full-width image)   │  │  │
│  │  │                                                                 │  │  │
│  │  │ Desktop (≥768px):                                               │  │  │
│  │  │   → viewMode === 'text-focus': side-by-side (60% text, 40% img) │  │  │
│  │  │   → viewMode === 'image-focus': stacked (100% width image)      │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │  Image Click Behavior:                                                 │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ if enableLightbox && imageUrl:                                  │  │  │
│  │  │   → Show cursor-zoom-in                                         │  │  │
│  │  │   → onClick: call onImageClick(imageUrl) or open internal modal │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│                              ▼                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     ImageLightbox.tsx (NEW)                            │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │  Props:                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ open: boolean                                                   │  │  │
│  │  │ onOpenChange: (open: boolean) => void                           │  │  │
│  │  │ imageUrl: string                                                │  │  │
│  │  │ imageAlt?: string                                               │  │  │
│  │  │ caption?: string                                                │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │  Features:                                                             │  │
│  │  • Full-screen overlay with dark backdrop                             │  │
│  │  • Centered image with max dimensions (90vw x 85vh)                   │  │
│  │  • Close button (X) in top-right                                      │  │
│  │  • Keyboard support: Escape to close                                  │  │
│  │  • Click outside to close                                             │  │
│  │  • Optional zoom controls (future enhancement)                        │  │
│  │  • Touch-friendly on mobile                                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

| File | Action | Scope |
|------|--------|-------|
| `src/components/slides/ImageLightbox.tsx` | **CREATE** | New component for full-screen image viewing |
| `src/components/slides/ViewModeToggle.tsx` | **CREATE** | New component for layout toggle button |
| `src/components/slides/SlideRenderer.tsx` | **MODIFY** | Add responsive layout logic + lightbox integration |
| `src/components/slides/LectureSlideViewer.tsx` | **MODIFY** | Add viewMode state + toggle button in header |
| `src/components/slides/StudentSlideViewer.tsx` | **MODIFY** | Add viewMode state + toggle button in header |
| `src/components/slides/index.ts` | **MODIFY** | Export new components |

---

## Detailed Component Specifications

### 1. ImageLightbox.tsx (NEW)

**Purpose**: Full-screen modal for viewing images at maximum size

**Location**: `src/components/slides/ImageLightbox.tsx`

**Dependencies**:
- `@/components/ui/dialog` (existing - Dialog, DialogContent)
- `lucide-react` (existing - X, ZoomIn icons)
- `cn` utility (existing)

**Props Interface**:
```typescript
interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  imageAlt?: string;
  caption?: string;
}
```

**Behavior**:
1. Uses shadcn Dialog for accessibility
2. Dark backdrop (bg-black/90)
3. Image centered with `object-contain`
4. Max size: 90vw width, 85vh height
5. Close via: X button, Escape key, backdrop click
6. Optional caption displayed below image

**Styling**:
- Minimal UI - focus on image
- Smooth fade-in animation
- No scroll, fixed positioning

---

### 2. ViewModeToggle.tsx (NEW)

**Purpose**: Button to switch between text-focus and image-focus layouts

**Location**: `src/components/slides/ViewModeToggle.tsx`

**Dependencies**:
- `@/components/ui/button` (existing)
- `@/components/ui/tooltip` (existing)
- `lucide-react` (existing - LayoutGrid, Maximize2 icons)

**Props Interface**:
```typescript
type ViewMode = 'text-focus' | 'image-focus';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}
```

**Behavior**:
1. Single button that toggles between modes
2. Icon changes based on current mode:
   - `text-focus`: shows LayoutGrid icon, tooltip "Switch to Image Focus"
   - `image-focus`: shows Maximize2 icon, tooltip "Switch to Text Focus"
3. Hidden on mobile (< md breakpoint) since layout is always stacked

**Visual Design**:
- Ghost variant button
- Matches existing header button styling
- Smooth icon transition

---

### 3. SlideRenderer.tsx (MODIFY)

**Current State**: Renders slides with fixed side-by-side layout for visual content

**Changes Required**:

#### A. New Props (all optional for backward compatibility):
```typescript
interface SlideRendererProps {
  // Existing props remain unchanged
  slide: Slide | EnhancedSlide | ProfessorSlide;
  slideNumber: number;
  totalSlides: number;
  showSpeakerNotes?: boolean;
  showPedagogy?: boolean;
  
  // NEW props
  viewMode?: 'text-focus' | 'image-focus';  // Default: 'text-focus'
  enableLightbox?: boolean;                  // Default: true
  onImageClick?: (imageUrl: string) => void; // Optional external handler
}
```

#### B. Internal State:
```typescript
const [lightboxImage, setLightboxImage] = useState<string | null>(null);
```

#### C. Layout Logic Changes:

**Current layout code (lines ~350-400)**:
```tsx
// Current: Always side-by-side when visual exists
<div className="flex gap-6">
  <div className="flex-1">{/* text content */}</div>
  <div className="w-[40%]">{/* image */}</div>
</div>
```

**New layout code**:
```tsx
// Responsive + view mode aware
const layoutClasses = cn(
  "flex gap-6",
  // Mobile: always stacked (column)
  "flex-col",
  // Desktop: depends on viewMode
  viewMode === 'text-focus' ? "md:flex-row" : "md:flex-col"
);

const imageContainerClasses = cn(
  // Mobile: full width
  "w-full",
  // Desktop text-focus: 40% width
  viewMode === 'text-focus' && "md:w-[40%]",
  // Desktop image-focus: full width, larger height
  viewMode === 'image-focus' && "md:w-full"
);
```

#### D. Image Click Handler:
```tsx
const handleImageClick = (imageUrl: string) => {
  if (enableLightbox) {
    if (onImageClick) {
      onImageClick(imageUrl);
    } else {
      setLightboxImage(imageUrl);
    }
  }
};

// On image element:
<img
  src={imageUrl}
  alt={imageAlt}
  className={cn(
    "rounded-lg object-contain",
    enableLightbox && "cursor-zoom-in hover:opacity-90 transition-opacity"
  )}
  onClick={() => handleImageClick(imageUrl)}
/>
```

#### E. Lightbox Integration:
```tsx
{/* At end of component, before closing tag */}
<ImageLightbox
  open={!!lightboxImage}
  onOpenChange={(open) => !open && setLightboxImage(null)}
  imageUrl={lightboxImage || ''}
  imageAlt="Slide visual"
  caption={slide.visual_suggestion || undefined}
/>
```

---

### 4. LectureSlideViewer.tsx (MODIFY)

**Current State**: Full-screen modal for instructor to view/manage slides

**Changes Required**:

#### A. New State:
```typescript
const [viewMode, setViewMode] = useState<'text-focus' | 'image-focus'>('text-focus');
```

#### B. Header Addition (alongside existing buttons):
```tsx
// In header controls section (around line 180)
<ViewModeToggle
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  className="hidden md:flex" // Only show on desktop
/>
```

#### C. Pass to SlideRenderer:
```tsx
<SlideRenderer
  slide={currentSlide}
  slideNumber={currentSlideIndex + 1}
  totalSlides={slides.length}
  showSpeakerNotes={showSpeakerNotes}
  viewMode={viewMode}         // NEW
  enableLightbox={true}        // NEW
/>
```

---

### 5. StudentSlideViewer.tsx (MODIFY)

**Current State**: Full-screen viewer for students with navigation

**Changes Required**: Same pattern as LectureSlideViewer

#### A. New State:
```typescript
const [viewMode, setViewMode] = useState<'text-focus' | 'image-focus'>('text-focus');
```

#### B. Header Addition:
```tsx
// In header controls section (around line 150)
<ViewModeToggle
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  className="hidden md:flex"
/>
```

#### C. Pass to SlideRenderer:
```tsx
<SlideRenderer
  slide={currentSlide}
  slideNumber={currentSlideIndex + 1}
  totalSlides={slides.length}
  showSpeakerNotes={showSpeakerNotes}
  viewMode={viewMode}
  enableLightbox={true}
/>
```

---

### 6. index.ts (MODIFY)

**Changes**: Export new components

```typescript
// Add to existing exports
export { ImageLightbox } from './ImageLightbox';
export { ViewModeToggle } from './ViewModeToggle';
```

---

## Responsive Behavior Summary

| Screen Size | Layout | View Toggle | Lightbox |
|-------------|--------|-------------|----------|
| Mobile (<640px) | Always stacked | Hidden | Yes (tap) |
| Tablet (640-768px) | Always stacked | Hidden | Yes (tap) |
| Desktop (≥768px) | Based on viewMode | Visible | Yes (click) |

---

## Backward Compatibility Guarantees

1. **SlideRenderer**: All new props are optional with sensible defaults
   - `viewMode` defaults to `'text-focus'` (current behavior)
   - `enableLightbox` defaults to `true`
   
2. **Existing consumers**: VideoPreviewModal and any other SlideRenderer users continue working unchanged

3. **No breaking changes**: Existing layouts render identically when no new props passed

---

## Testing Checklist

### Functional Tests:
- [ ] Desktop: View mode toggle switches layout correctly
- [ ] Desktop: Image click opens lightbox
- [ ] Mobile: Layout is always stacked regardless of viewMode
- [ ] Mobile: View toggle is hidden
- [ ] Mobile: Image tap opens lightbox
- [ ] Lightbox: Escape key closes
- [ ] Lightbox: Click outside closes
- [ ] Lightbox: X button closes
- [ ] All slide types render correctly in both modes

### Visual Tests:
- [ ] Instructor view: Toggle button matches header styling
- [ ] Student view: Toggle button matches header styling
- [ ] Lightbox: Image properly centered and sized
- [ ] Lightbox: Dark backdrop with proper opacity
- [ ] Transitions are smooth

### Edge Cases:
- [ ] Slides without images: No lightbox trigger, layout unchanged
- [ ] Very wide images: Contained properly in lightbox
- [ ] Very tall images: Contained properly in lightbox
- [ ] Long captions: Truncated or wrapped properly

---

## Implementation Order

1. **Phase 1: Create New Components**
   - ImageLightbox.tsx
   - ViewModeToggle.tsx
   - Update index.ts exports

2. **Phase 2: Update SlideRenderer**
   - Add new props interface
   - Add internal lightbox state
   - Implement responsive layout logic
   - Add image click handler
   - Integrate ImageLightbox

3. **Phase 3: Update Viewers**
   - LectureSlideViewer: Add state + toggle + pass props
   - StudentSlideViewer: Add state + toggle + pass props

4. **Phase 4: Testing**
   - Manual testing on desktop + mobile
   - Verify backward compatibility

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing slide rendering | All new props optional with defaults matching current behavior |
| Performance impact of lightbox | Lazy render - only mount when opened |
| Touch interaction conflicts | Use `onClick` which works for both click and tap |
| Layout shift on mode change | Use CSS transitions for smooth change |

---

## Estimated Implementation Time

- ImageLightbox.tsx: ~30 lines
- ViewModeToggle.tsx: ~40 lines
- SlideRenderer.tsx changes: ~50 lines modified
- LectureSlideViewer.tsx changes: ~15 lines added
- StudentSlideViewer.tsx changes: ~15 lines added
- index.ts: ~2 lines added

**Total**: ~150 lines of new/modified code
