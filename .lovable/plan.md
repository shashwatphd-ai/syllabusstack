

# Logo Update and Color Scheme Alignment Plan

## Overview

This plan updates the SyllabusStack logo to match the uploaded brand asset and adjusts the color scheme throughout the application to align with the new logo colors.

## Current State Analysis

**Current Logo Component** (`src/components/common/Logo.tsx`):
- Uses a CSS-generated icon with horizontal bars on a coral gradient background
- Text uses coral accent for "Stack"
- Colors: coral/orange (#F97316-ish) and indigo (#4F46E5-ish)

**New Logo Requirements** (from uploaded image):
- 3D stacked book/layer icon with orange and dark purple colors
- "Syllabus" in dark indigo/purple
- "Stack" in orange/amber
- The icon has a distinctive 3D perspective with interlocking layers

## Implementation Plan

### Step 1: Copy Logo Image to Project

Copy the uploaded logo to the src/assets folder for proper bundling:
```
lov-copy user-uploads://image-133.png src/assets/syllabusstack-logo.png
```

### Step 2: Update Logo Component

**File: `src/components/common/Logo.tsx`**

Replace the CSS-generated icon with the actual logo image:

```typescript
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import logoImage from "@/assets/syllabusstack-logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark" | "auto";
  showText?: boolean;
  showIcon?: boolean;
  className?: string;
}

export const Logo = forwardRef<HTMLDivElement, LogoProps>(
  ({ size = "md", variant = "auto", showText = true, showIcon = true, className }, ref) => {
    const sizes = {
      sm: { icon: "h-8", text: "text-lg", full: "h-8" },
      md: { icon: "h-10", text: "text-xl", full: "h-10" },
      lg: { icon: "h-12", text: "text-2xl", full: "h-12" },
      xl: { icon: "h-16", text: "text-3xl", full: "h-16" },
    };

    const textColor = {
      light: "text-white",
      dark: "text-indigo-900",
      auto: "text-indigo-900 dark:text-white",
    };

    const accentColor = {
      light: "text-amber-400",
      dark: "text-amber-500",
      auto: "text-amber-500 dark:text-amber-400",
    };

    // If showing both icon and text, use the full logo image
    if (showIcon && showText) {
      return (
        <div ref={ref} className={cn("flex items-center", className)}>
          <img 
            src={logoImage} 
            alt="SyllabusStack" 
            className={cn("object-contain", sizes[size].full)}
          />
        </div>
      );
    }

    // Icon only mode - crop/show just the icon portion
    if (showIcon && !showText) {
      return (
        <div ref={ref} className={cn("flex items-center", className)}>
          <img 
            src={logoImage} 
            alt="SyllabusStack" 
            className={cn("object-contain object-left", sizes[size].icon)}
            style={{ clipPath: 'inset(0 60% 0 0)' }}
          />
        </div>
      );
    }

    // Text only mode
    return (
      <div ref={ref} className={cn("flex items-center", className)}>
        <span className={cn("font-bold tracking-tight", sizes[size].text, textColor[variant])}>
          Syllabus<span className={accentColor[variant]}>Stack</span>
        </span>
      </div>
    );
  }
);

Logo.displayName = "Logo";
```

### Step 3: Update Color Scheme in CSS

**File: `src/index.css`**

Update the color variables to match the logo's purple and orange palette:

**Light Mode Updates (lines 29-31, 41-43, 57, 68-70):**
```css
/* Primary - Deep purple/indigo from logo */
--primary: 262 60% 35%;
--primary-foreground: 0 0% 100%;

/* Accent - Amber/orange from logo */
--accent: 38 95% 50%;
--accent-foreground: 0 0% 100%;

--ring: 262 60% 35%;

/* Updated extended palette to match logo */
--indigo-900: 262 60% 20%;
--indigo-800: 262 55% 25%;
--indigo-700: 262 50% 30%;
--indigo-600: 262 48% 35%;
--indigo-500: 262 45% 40%;

/* Amber palette replacing coral */
--amber-500: 38 92% 50%;
--amber-400: 38 95% 55%;
--amber-300: 38 90% 65%;
```

**Dark Mode Updates (lines 121-122, 130-131, 138, 142-145):**
```css
--primary: 38 92% 55%;
--primary-foreground: 262 60% 15%;

--accent: 262 50% 40%;
--accent-foreground: 38 92% 55%;

--ring: 38 92% 55%;

--sidebar-background: 262 60% 8%;
--sidebar-primary: 38 92% 55%;
--sidebar-primary-foreground: 262 60% 15%;
--sidebar-accent: 262 45% 35%;
```

### Step 4: Update Tailwind Config

**File: `tailwind.config.ts`**

Replace `coral` palette with `amber` to match the new logo (lines 107-111):

```typescript
amber: {
  '300': 'hsl(var(--amber-300))',
  '400': 'hsl(var(--amber-400))',
  '500': 'hsl(var(--amber-500))'
},
```

### Step 5: Update Sidebar Logo

**File: `src/components/layout/Sidebar.tsx`**

Update the inline logo (lines 105-114) to use the Logo component:

```typescript
import { Logo } from '@/components/common/Logo';

// Replace the current logo section with:
<Link to="/dashboard" className="flex items-center gap-2">
  <Logo 
    size="sm" 
    showText={!isCollapsed} 
    showIcon={true}
    variant="auto"
  />
</Link>
```

### Step 6: Global Search and Replace

Update all references from `coral-` to `amber-` across the codebase:

Files to update:
- `src/components/common/Logo.tsx` (already done above)
- `src/components/common/LoadingState.tsx` - update any coral references
- Any other files using `coral-400`, `coral-500`, etc.

### Step 7: Update Gradient Variables

**File: `src/index.css`**

Update gradient definitions to use new colors (lines 72-76):

```css
/* Gradients - updated to purple and amber */
--gradient-hero: linear-gradient(135deg, hsl(262 60% 15%) 0%, hsl(262 50% 25%) 50%, hsl(262 45% 30%) 100%);
--gradient-accent: linear-gradient(135deg, hsl(38 92% 50%) 0%, hsl(42 90% 55%) 100%);
--shadow-glow: 0 0 40px hsl(38 92% 50% / 0.25);
```

## Files to Modify Summary

| File | Action | Description |
|------|--------|-------------|
| `src/assets/syllabusstack-logo.png` | CREATE | Copy uploaded logo image |
| `src/components/common/Logo.tsx` | EDIT | Use actual logo image, update colors |
| `src/index.css` | EDIT | Update color variables (primary, accent, gradients) |
| `tailwind.config.ts` | EDIT | Replace coral with amber palette |
| `src/components/layout/Sidebar.tsx` | EDIT | Use Logo component instead of inline |

## Color Palette Reference

From the uploaded logo:
- **Dark Purple/Indigo**: ~hsl(262, 60%, 35%) - used for "Syllabus" text
- **Amber/Orange**: ~hsl(38, 92%, 50%) - used for "Stack" text and icon layers
- **Icon layers**: Gradient from amber to dark purple with 3D perspective

## Visual Result

After implementation:
- Landing page header will show the new logo
- Sidebar will display icon-only when collapsed, full logo when expanded
- All accent colors (buttons, links, highlights) will use amber instead of coral
- Primary actions will use the deep purple from the logo
- Overall aesthetic will match the professional purple-orange brand identity

