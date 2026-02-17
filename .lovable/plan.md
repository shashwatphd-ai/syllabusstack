

## UX and Visual Audit: Student Course Detail + Learning Objective Pages

### Problems Identified

**Page 1: Course Detail (StudentCourseDetail.tsx)**

1. **Flat numbering with no hierarchy** -- Modules are numbered 1, 2, 3... but visually there is no distinction between the "Course Objectives" module (which is a top-level container) and regular modules like "Module 1: Strategy...". They all look the same.
2. **Redundant numbering vs. title numbering** -- The circle shows "2" but the title says "Module 1: Strategy...". This is confusing -- the circle number and the module's own label disagree.
3. **No font hierarchy** -- The course title, module titles, and LO text all use very similar font sizes and weights. Everything looks the same priority.
4. **Progress bar is a black slab** -- The 0% progress bar is solid dark, making it feel heavy and unfinished rather than encouraging.
5. **LO cards inside accordions lack visual rhythm** -- The amber highlight on verified LOs is good, but non-verified LOs have no visual differentiation from the card border. Status badges are small and uniform.
6. **No section labels or dividers** -- The page jumps from progress card to modules with no visual grouping or section header.

**Page 2: Learning Objective Detail (LearningObjective.tsx)**

7. **No numbered hierarchy for videos** -- Videos are shown as a flat 2-column grid with no sequence numbers, making it unclear which to watch first.
8. **Lecture slides use independent numbering (1, 2, 3)** -- These numbers restart at 1 and have no relationship to the module or course hierarchy.
9. **Typography is uniform** -- Section headers ("Videos", "Lecture Slides") use the same small semibold style as card content. There is no clear visual weight difference between the page title, section headers, and item labels.
10. **The "Back to Course" breadcrumb is a plain ghost button** -- No breadcrumb trail showing Course > Module > Objective context.
11. **Badge styling inconsistency** -- "Understand" uses a filled purple badge while "verified" uses an outline badge. The match percentage badges are tiny and hard to read.
12. **No visual step/progress indicator** -- The page doesn't communicate where the student is in the flow (Watch -> Verify -> Assess -> Pass).

### Plan

All changes are **frontend-only** -- no backend, no hooks, no data model changes.

---

#### 1. Consistent Hierarchical Numbering (both pages)

On the Course Detail page, change module circle numbers to match the module's own numbering. If the module title already says "Module 1:", suppress the circle number and show a module icon instead. For the generic "Course Objectives" module, show a bookmark icon.

On the LO Detail page, add numbered badges (1, 2, 3...) to each video card sorted by match score descending. Add hierarchical numbering to lecture slides using the format matching the parent module (e.g., "1.1", "1.2").

#### 2. Typographic Hierarchy

Apply a professional font scale across both pages:
- **Page title**: `text-2xl font-bold tracking-tight` (course name / LO text)
- **Section headers**: `text-base font-semibold uppercase tracking-wide text-muted-foreground` (e.g., "VIDEOS", "LECTURE SLIDES", "MODULES")
- **Card titles**: `text-sm font-medium` (unchanged)
- **Meta text**: `text-xs text-muted-foreground` (unchanged)

This creates clear visual layers: Title > Section > Item > Meta.

#### 3. Progress Flow Indicator (LO Detail page)

Add a horizontal step indicator below the LO title showing the student's position in the pipeline:

```
Watch Content -> Verify -> Assessment -> Mastered
```

Use the verification state machine to highlight the current step. Steps use small circles with connecting lines, colored per the brand palette (muted for future, primary for current, success for completed).

#### 4. Improved Progress Bar Styling (Course Detail page)

Replace the heavy black progress bar with the brand primary color. Add a subtle gradient or use `bg-primary` for the filled portion and `bg-muted` for the track. Show the percentage inside the bar when > 10%.

#### 5. Section Grouping with Labels

On the Course Detail page, add a subtle "Modules" section header above the accordion list.

On the LO Detail page, upgrade section headers from small card titles to standalone section labels with an icon and description on a single line, outside the cards. This removes one level of visual nesting.

#### 6. Video Cards -- Numbered and Ranked

Add a rank number to each video card (top-left corner or as a leading element). Sort by match score descending. Style the match badge more prominently with color coding:
- 70%+ match: green-tinted badge
- 50-69%: amber-tinted badge  
- Below 50%: muted badge

#### 7. Breadcrumb Context (LO Detail page)

Replace the "Back to Course" ghost button with a compact breadcrumb: `Course Name > Module Name > [current LO]`. The first two segments are clickable links. This provides context without taking much space.

---

### Technical Details

**Files to modify:**

| File | Changes |
|------|---------|
| `src/pages/student/StudentCourseDetail.tsx` | Typographic hierarchy, module numbering logic, progress bar color, section labels |
| `src/pages/student/LearningObjective.tsx` | Breadcrumb, step indicator, video numbering, lecture slide hierarchical numbering, section headers outside cards, match badge color coding |
| `src/lib/verification-state-machine.ts` | No changes needed (read-only reference for step indicator) |

**No changes to:**
- Any hooks or data fetching
- Any backend or database logic
- Any other pages or components

**Risk:** Zero -- all changes are CSS classes and JSX layout within the two page components. No props, hooks, or data contracts change.

