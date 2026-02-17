

## Landing Page Copy Cleanup -- Simple, Smart, Honest

### Problem Summary

The landing page has 14 specific copy issues ranging from factually wrong pricing claims to vague buzzwords and mocking-potential taglines. These undermine the simplicity and smartness SyllabusStack stands for.

### All Changes (by file)

---

### 1. HeroSection.tsx (Student side)

| Line | Current | Fix | Reason |
|------|---------|-----|--------|
| 143-152 | "Know Your **Real** Job Readiness" | "See How Your Coursework Maps to Jobs" | "Real" implies other tools lie. The new version is specific about what the product does. |
| 157 | "honest AI analysis" | "AI-powered skill mapping" | "Honest" is defensive -- implies others are dishonest, invites skepticism. |
| 178 | "First analysis free" | "Free to start" | Aligns with pricing (first dream job analysis is included in free tier). Simpler. |
| 186 | "Results in minutes" | "No resume needed" | "Minutes" is vague and unverifiable. "No resume needed" is a concrete differentiator. |

### 2. HeroSection.tsx (Instructor side)

| Line | Current | Fix | Reason |
|------|---------|-----|--------|
| 231 | "$1 per course or go Pro" | "$1 per course, or unlimited with Pro" | Clearer value prop. "Go Pro" sounds like a gaming upsell. |
| 239 | "Know who's paying attention" | "Track who's actually watching" | "Paying attention" sounds surveillance-y. "Actually watching" matches the micro-check feature. |

### 3. PricingSection.tsx

| Line | Current | Fix | Reason |
|------|---------|-----|--------|
| 18 | "$1 per course/enrollment" | "$1 per course created" | Enrollment is currently free (`ENROLLMENT_FREE = true`). This is factually wrong. |
| 228 | "* Free tier includes $1 fee per course creation or enrollment." | "* Free tier charges $1 per course you create. Enrollment is free." | Same -- enrollment is free, footnote says otherwise. |

### 4. HowItWorksSection.tsx (Instructor mockups)

| Line | Current | Fix | Reason |
|------|---------|-----|--------|
| 167 | "freeCodeCamp" | "Coding Tutorial Channel" | Using a real brand name without permission creates IP risk. |
| 168 | "98% match" | "High match" | 98% sets unrealistic expectations. Real match scores vary. |
| 176 | "CS Dojo" | "Programming Basics" | Same IP risk as above. |
| 177 | "94% match" | "Good match" | Same unrealistic precision issue. |

### 5. CTASection.tsx

| Line | Current | Fix | Reason |
|------|---------|-----|--------|
| 48 | "Start exploring free" | "Free to get started" | "Exploring" is vague -- what are they exploring? |
| 52 | "Pro unlocks everything" | "Pro removes all limits" | "Everything" overpromises. "Removes limits" is specific and true. |
| 56 | "Set up in minutes" | "No credit card required" | "Minutes" is the same vague claim repeated 3 times across the page. A concrete trust signal is better. |

### 6. Footer.tsx

| Line | Current | Fix | Reason |
|------|---------|-----|--------|
| 87 | "Made with AI that tells the truth." | "Built for learners and educators." | HIGH PRIORITY. The current line is the single highest mocking risk on the entire page. It invites "does it though?" responses and reads as naive or arrogant. The replacement is simple and on-brand. |

### 7. FeaturesSection.tsx -- No changes needed

The feature descriptions are specific, honest, and well-written. No issues found.

### 8. Header.tsx -- No changes needed

Clean and functional.

---

### What stays the same

- All layout, styling, and visual design -- untouched
- Instructor hero headline ("Turn Your Syllabus Into a Video Course") -- clear and accurate
- All feature descriptions -- already well-written
- Testimonials section -- already returns null (honest, no fake reviews)
- Pricing structure and tiers -- only the copy within them changes
- All navigation, links, and routing

### Technical Notes

- All changes are string-only edits in 5 files
- No logic, layout, or component structure changes
- No database or backend changes
- Total: ~14 string replacements across `HeroSection.tsx`, `PricingSection.tsx`, `HowItWorksSection.tsx`, `CTASection.tsx`, and `Footer.tsx`

