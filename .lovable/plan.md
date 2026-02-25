

## UX Revision Plan: Landing, Auth, Onboarding & Supporting Pages

This is a large revision touching ~15 files. The work is broken into priority tiers that can be implemented sequentially.

---

### Priority 0 -- High Impact (Landing Page Core)

**1. Unified audience state + remove duplicate toggles**

Currently HeroSection, FeaturesSection, and HowItWorksSection each have independent `useState<Audience>` toggles. Clicking "I'm an Educator" in the hero doesn't affect the other sections.

- **Solution**: Lift the audience state to the parent `Index.tsx` page and pass it as a prop to all three sections. A single toggle in the Hero controls all sections.
- Files: `src/pages/Index.tsx`, `HeroSection.tsx`, `FeaturesSection.tsx`, `HowItWorksSection.tsx`

**2. Reduce hero height**

Change `min-h-screen` to `py-24 lg:py-32` on HeroSection so features are visible above the fold on most screens.

- File: `HeroSection.tsx` (line 13)

**3. Fix coral → amber color references**

`coral-*` classes (e.g. `bg-coral-500`, `text-coral-400`, `from-coral-300`) are used ~30 times across HeroSection, CTASection, and HowItWorks standalone page but are **not defined** in `tailwind.config.ts`. They silently fail (no color rendered).

Two options:
- **Option A** (recommended): Add `coral` as an alias for `amber` in `tailwind.config.ts` so existing classes work.
- **Option B**: Find/replace all `coral-300` → `amber-300`, `coral-400` → `amber-400`, `coral-500` → `amber-500` across the 3 affected files.

We will go with **Option A** (less risk, fewer file touches) plus a comment noting the alias.

- File: `tailwind.config.ts`

**4. Replace null TestimonialsSection with honest social proof**

Currently returns `null`. Replace with an honest early-stage section: "Built for learners and educators" with concrete trust signals (e.g., "Open-source curriculum mapping", "AI-powered analysis", "No fake metrics"). No fabricated user counts or testimonial quotes.

- File: `src/components/landing/TestimonialsSection.tsx` (~60 lines new)

**5. Differentiate CTAs by audience**

Student CTA links to `/auth?role=student`, instructor CTA links to `/auth?role=instructor`. Currently both go to `/auth` with no distinction.

- Files: `HeroSection.tsx`

---

### Priority 1 -- Medium Impact

**6. Auth page: Use Logo component + role-aware left panel**

- Replace `GraduationCap` icon with `<Logo variant="light" />` in left panel and mobile header
- Read `?role=` query param; show instructor-oriented copy when `role=instructor`, student copy otherwise
- Files: `src/pages/Auth.tsx`

**7. Employers page: Use shared Header/Footer + remove fake stats**

- Replace custom nav (lines 112-129) with `<Header />`
- Replace custom footer (lines 377-393) with `<Footer />`
- Remove the stats section with fabricated numbers ("50K+ Certificates Issued", "500+ Employers Trust Us")
- Simplify pricing to a single "Contact us" CTA instead of 3-tier pricing that doesn't exist yet
- Remove the false CTA copy "Join hundreds of employers who trust SyllabusStack"
- File: `src/pages/Employers.tsx`

**8. Universities page: Expand from stub**

Currently 2 cards with no header/footer. Expand to:
- Add `<Header />` and `<Footer />`
- Hero section with clear value proposition
- 4-6 value prop cards (curriculum mapping, career alignment, cohort analytics, instructor tools)
- CTA section with "Schedule a Demo" / "Contact Us"
- Remove the bare "Back to Home" button
- File: `src/pages/Universities.tsx` (~150 lines rewrite)

**9. HowItWorks standalone page: Tone revision**

The `/how-it-works` page has aggressive anti-cheating language that contradicts the "Simple, Smart, Honest" positioning:
- "We Know the Tricks" → soften to "Built for Real Engagement"
- "You can't game the system—so you might as well actually learn" → remove
- "Join thousands of students" (false) → honest CTA
- "Tab Focus Monitoring" / "Background playing is tracked and penalized" → reframe as engagement features, not surveillance
- File: `src/pages/HowItWorks.tsx` (copy changes in ~10 locations)

---

### Priority 2 -- Low Impact / Cleanup

**10. Onboarding: Use Logo component**

- Replace `Sparkles` icon + manual "SyllabusStack" text in OnboardingWizard header (line 299) with `<Logo size="sm" />`
- Replace manual text in `Onboarding.tsx` page wrapper with `<Logo />`
- Files: `src/components/onboarding/OnboardingWizard.tsx`, `src/pages/Onboarding.tsx`

**11. Remove unused Google Font imports**

Currently importing 7 font families (9 `@import` lines). The tailwind config only uses Roboto, Inter, Libre Caslon Text, and Roboto Mono. Remove:
- Plus Jakarta Sans (line 1)
- Space Grotesk (line 2)
- Lora (line 3)
- Space Mono (lines 4, 6 -- imported twice)
- Inter duplicate (line 5 -- already imported on line 1)

This eliminates ~4-5 render-blocking font requests on initial load.

- File: `src/index.css` (remove lines 2-6)

**12. Delete dead auth form components**

`LoginForm.tsx` and `SignupForm.tsx` use TanStack Form with dummy handlers. They're never imported by the active Auth page. Delete them and update the barrel export.

- Delete: `src/components/auth/LoginForm.tsx`
- Delete: `src/components/auth/SignupForm.tsx`
- Update: `src/components/auth/index.ts` (remove LoginForm and SignupForm exports)

**13. 404 page: Use Link instead of anchor**

Replace `<a href="/">` with `<Link to="/">` to avoid full page reload.

- File: `src/pages/NotFound.tsx` (2 lines)

---

### Technical Notes

- **No behavioral changes** to auth flow, onboarding persistence, routing, or backend integration
- **No new dependencies** required
- All changes are copy, layout, and component composition updates
- The coral→amber alias in tailwind config is the safest fix since coral classes are used in ~30 locations across 3 files
- Audience state lifting requires adding an `audience` prop to HeroSection, FeaturesSection, and HowItWorksSection (currently they use internal state)

### Estimated Scope

- ~15 files touched
- ~500-600 lines changed (including Universities rewrite)
- ~300 lines removed (dead code, unused fonts)
- 2 files deleted (dead form components)

