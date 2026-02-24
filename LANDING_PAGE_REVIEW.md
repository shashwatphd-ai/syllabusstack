# SyllabusStack Landing & Initial Pages — UX Review & Revision Plan

**Date:** 2026-02-24
**Reviewer:** Claude (AI UX Audit)
**Scope:** All public-facing and initial-experience pages — Landing (`/`), Auth (`/auth`), Onboarding (`/onboarding`), How It Works (`/how-it-works`), Employers (`/employers`), Universities (`/universities`), 404

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack Context](#2-tech-stack-context)
3. [Page-by-Page Review](#3-page-by-page-review)
   - [3.1 Landing Page (/)](#31-landing-page-)
   - [3.2 Auth Page (/auth)](#32-auth-page-auth)
   - [3.3 Onboarding (/onboarding)](#33-onboarding-onboarding)
   - [3.4 How It Works (/how-it-works)](#34-how-it-works-how-it-works)
   - [3.5 Employers (/employers)](#35-employers-employers)
   - [3.6 Universities (/universities)](#36-universities-universities)
   - [3.7 404 Page](#37-404-page)
4. [Cross-Cutting Issues](#4-cross-cutting-issues)
5. [Proposed Revision Plan with Wireframes](#5-proposed-revision-plan-with-wireframes)
6. [Impact Assessment & File Map](#6-impact-assessment--file-map)

---

## 1. Executive Summary

SyllabusStack has a functional landing experience with a dual-audience (student/instructor) toggle pattern, a complete auth flow, and a multi-step onboarding wizard. The visual foundation is solid—deep indigo/purple hero sections with amber accents, shadcn/ui components, and responsive layouts.

**Key problems identified:**

| # | Issue | Severity | Pages Affected |
|---|-------|----------|----------------|
| 1 | Identity crisis: landing page serves two audiences but dilutes both value props | High | `/` |
| 2 | Audience toggles are duplicated across Hero, Features, and How It Works — state is not synchronized | Medium | `/` |
| 3 | TestimonialsSection renders `null` — creates a gap in the persuasion flow | Medium | `/` |
| 4 | Auth page branding panel uses generic `GraduationCap` icon instead of the custom Logo component | Low | `/auth` |
| 5 | Three separate unused form components: `LoginForm.tsx` and `SignupForm.tsx` are dead code (Auth.tsx handles both) | Low | Dead code |
| 6 | Employers page uses its own nav/footer instead of the shared Header/Footer | Medium | `/employers` |
| 7 | Universities page is a stub — two cards with no nav, no CTA funnel, no pricing | High | `/universities` |
| 8 | Landing page has no social proof section (testimonials removed, no stats/logos) | High | `/` |
| 9 | Onboarding wizard renders its own header instead of using the shared Logo component | Low | `/onboarding` |
| 10 | HowItWorks standalone page (`/how-it-works`) overlaps significantly with the landing page section | Medium | `/how-it-works` |
| 11 | "coral" classes referenced in hero/CTA despite CSS migrating to amber palette | Medium | `/` |
| 12 | Multiple Google Font imports (7 families) — performance drag on initial load | Medium | Global |
| 13 | Hero section is `min-h-screen` — pushes all value content below the fold | Medium | `/` |
| 14 | No clear CTA differentiation between student and instructor paths | High | `/` |
| 15 | Footer links to Resources, Blog, Career Guides — these appear to be placeholder pages | Low | `/` |

---

## 2. Tech Stack Context

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite + TypeScript |
| Router | react-router-dom v7 |
| UI Library | shadcn/ui (Radix primitives) |
| Styling | Tailwind CSS 3.4 + tailwindcss-animate |
| State | React Query (TanStack Query) |
| Auth | Supabase |
| Forms | react-hook-form (Auth.tsx), TanStack Form (LoginForm.tsx, SignupForm.tsx) |
| Color scheme | Indigo/purple primary, amber accent, coral remnants in hero |

---

## 3. Page-by-Page Review

### 3.1 Landing Page (`/`)

**Current structure (top to bottom):**

```
┌──────────────────────────────────────────────────┐
│  HEADER (fixed, indigo-900/80 backdrop-blur)     │
│  [Logo]     Features | How It Works | Pricing    │
│                                   [Log In] [CTA] │
├──────────────────────────────────────────────────┤
│                                                  │
│  HERO SECTION (min-h-screen, bg-hero gradient)   │
│                                                  │
│  ┌────────────────────────────┐                  │
│  │ [I'm a Student] [I'm an Educator]│            │
│  └────────────────────────────┘                  │
│                                                  │
│  "See How Your Coursework Maps to Jobs"          │
│  (or "Turn Your Syllabus Into a Video Course")   │
│                                                  │
│  [Start Your Analysis] [See How It Works]        │
│                                                  │
│  ✓ Free to start  ✓ Pay per action  ✓ No resume │
│                                                  │
│  [Floating cards: Gap Analysis, Action Plan]     │
│                                                  │
├──────────────────────────────────────────────────┤
│  FEATURES SECTION                                │
│  Another [For Students] [For Educators] toggle   │
│  4 feature cards in grid                         │
├──────────────────────────────────────────────────┤
│  HOW IT WORKS SECTION                            │
│  Another [For Students] [For Educators] toggle   │
│  4 steps with inline visuals (2x2 grid)          │
├──────────────────────────────────────────────────┤
│  TESTIMONIALS SECTION → renders null             │
├──────────────────────────────────────────────────┤
│  PRICING SECTION                                 │
│  3 cards: Free / Pro ($9.99) / University        │
├──────────────────────────────────────────────────┤
│  CTA SECTION (bg-hero)                           │
│  "Stop Guessing. Start Knowing."                 │
│  [Get Started Free]                              │
├──────────────────────────────────────────────────┤
│  FOOTER (indigo-900)                             │
│  Logo | Product | Resources | Legal              │
│  Social: Twitter, LinkedIn, Email                │
└──────────────────────────────────────────────────┘
```

**Issues:**

1. **Three independent audience toggles** — Hero, Features, and How It Works each maintain their own `useState<Audience>`. If a user clicks "I'm an Educator" in the hero, the Features and How It Works sections still show student content. This is confusing.

2. **Hero takes full viewport** (`min-h-screen`) — Users see only the hero on first load. All trust signals, features, and pricing are below the fold. The scroll affordance is weak.

3. **No social proof** — The TestimonialsSection returns `null`. There's no stats bar, no logo wall, no user count. The page jumps directly from hero to features, missing the trust-building layer.

4. **Coral/amber naming inconsistency** — The CSS has migrated to amber (`--amber-500: 38 92% 50%`), but the hero and CTA sections still use `text-coral-300`, `text-coral-400`, `text-coral-500`, `bg-coral-500/10`. These `coral-*` classes aren't defined in tailwind.config.ts, so they resolve to the browser default (likely nothing or a fallback).

5. **Both CTAs go to `/auth`** — "Start Your Analysis" (student) and "Create Your Course" (instructor) both link to the same `/auth` page with no query param to indicate intent. The auth page doesn't know which audience arrived.

6. **Pricing doesn't connect to the audience toggle** — The Free tier says "$1 per course created" (instructor-facing) alongside "1 dream job analysis" (student-facing). The pricing section doesn't adjust based on the audience toggle above.

7. **Floating cards on hero** are `hidden xl:block` — invisible to most laptop users (< 1280px). This is decorative content that only a minority of users see.

---

### 3.2 Auth Page (`/auth`)

**Current structure:**

```
┌─────────────────────┬─────────────────────────┐
│                     │                         │
│  LEFT PANEL         │  RIGHT PANEL            │
│  (hidden on mobile) │  (full width on mobile) │
│                     │                         │
│  GraduationCap icon │  ┌───────────────────┐  │
│  "SyllabusStack"    │  │ [Login] [Sign Up]  │  │
│                     │  ├───────────────────┤  │
│  "Transform Your    │  │                   │  │
│   Education Into    │  │  Email            │  │
│   Career Readiness" │  │  Password         │  │
│                     │  │  [Forgot?]        │  │
│  ✓ AI-powered       │  │  [Log In]         │  │
│  ✓ Skill gaps       │  │                   │  │
│  ✓ Smart recs       │  └───────────────────┘  │
│                     │                         │
└─────────────────────┴─────────────────────────┘
```

**Issues:**

1. **Left panel uses `GraduationCap` icon** instead of the custom `<Logo />` component (which has a nice 3D stacked box SVG). Inconsistent branding.

2. **Left panel messaging is student-only** — "Transform Your Education Into Career Readiness" with "AI-powered syllabus analysis, Personalized skill gap identification, Smart course recommendations". Instructors who clicked "Create Your Course" on the landing page see student-oriented copy.

3. **No OAuth/SSO** — Email+password only. No Google, GitHub, or institutional SSO. This is common for early-stage but limits conversion.

4. **Dead code** — `LoginForm.tsx` and `SignupForm.tsx` in `components/auth/` use TanStack Form and have dummy `console.log` handlers. They're never imported by the active Auth page (which uses react-hook-form and real Supabase auth). These files add to bundle if tree-shaking misses them.

5. **Password visibility toggle** shares state between login and signup forms — a single `showPassword` state controls both tabs.

6. **Mobile header** — On mobile, only a `GraduationCap` + "SyllabusStack" text shows in the card header, while the left panel is hidden. This is fine but the mobile experience doesn't explain what SyllabusStack is before asking users to log in.

---

### 3.3 Onboarding (`/onboarding`)

**Current structure:**

```
┌──────────────────────────────────────────┐
│  Simple header: Sparkles icon +          │
│  "SyllabusStack"     Step X of 4         │
├──────────────────────────────────────────┤
│  [Progress bar ████████░░░░░]            │
│  (●) Profile  (●) Courses  (○) Jobs (○) │
├──────────────────────────────────────────┤
│                                          │
│  Step 1: Profile                         │
│  ┌────────────────────────────────┐      │
│  │ Full Name *                    │      │
│  │ University * │ Major           │      │
│  │ Level *      │ Grad Year       │      │
│  └────────────────────────────────┘      │
│                                          │
│  Step 2: Add Courses                     │
│  (Upload syllabi via CourseUploader)     │
│                                          │
│  Step 3: Dream Jobs                      │
│  [AI Suggestions] [Add Manually]         │
│                                          │
│  Step 4: Complete!                        │
│  Summary stats → [Go to Dashboard]       │
│                                          │
│  [Back]                    [Continue]    │
└──────────────────────────────────────────┘
```

**Issues:**

1. **Onboarding renders its own header** with a `Sparkles` icon instead of using the `<Logo />` component. The Onboarding page wrapper also renders "Syllabus<span>Stack</span>" manually with different styling than the Logo component.

2. **Student-only flow** — The onboarding wizard is designed exclusively for students (profile → courses → dream jobs). Instructors who sign up go through the same flow with irrelevant steps ("Add your dream jobs"). The instructor onboarding should be different (upload syllabus → configure course → publish).

3. **Step 2 says "Add your courses"** but it means "upload syllabi for analysis." This wording is confusing — "courses" in the instructor context means something different.

4. **No skip option** — Users must add at least 1 course and 1 dream job to proceed. This is a hard gate that may cause drop-off for users who want to explore first.

5. **State persistence is good** — Uses localStorage with 7-day expiry. This is a nice recovery feature.

---

### 3.4 How It Works (`/how-it-works`)

**Current structure:**

A full standalone page with Header/Footer that covers:
- Hero: "Prove You Learned It, Don't Just Claim You Watched It"
- Problem section: 4 problem cards (background playing, speed watching, tab switching, skipping)
- Student Journey: 6 steps from enrollment to assessment
- Anti-Gaming Measures: 4 cards (speed detection, segment tracking, tab focus, micro-check enforcement)
- For Instructors: 3 benefit cards + flow diagram
- Value Proposition: 3-column (Students, Instructors, Employers)
- CTA: "Ready for Verified Learning?"

**Issues:**

1. **Significant content overlap** with the landing page's HowItWorksSection — both explain "how it works" in 4 steps. The standalone page is more detailed but the existence of both is confusing.

2. **False social proof** — "Join thousands of students who are proving their learning" in the CTA, but the app appears to be early-stage. This undermines trust if users discover it's not true.

3. **Tone shift** — The landing page is warm and inviting. This page is aggressive about anti-cheating ("We Know the Tricks", "You can't game the system—so you might as well actually learn"). This could alienate students rather than attract them.

4. **No navigation link** — The landing page Header links to `#how-it-works` (the in-page section), not to `/how-it-works` (the standalone page). The standalone page is only accessible by direct URL.

---

### 3.5 Employers (`/employers`)

**Issues:**

1. **Uses its own nav and footer** instead of the shared `<Header />` and `<Footer />`. The nav uses a plain `S` letter in a rounded box instead of the custom Logo component. Visual inconsistency.

2. **False stats** — "50K+ Certificates Issued", "99.9% API Uptime", "500+ Employers Trust Us". These are fabricated for an early-stage product.

3. **API code sample** — References `api.syllabusstack.com` which likely doesn't exist yet. The pricing tiers ($99/mo Professional) seem premature.

4. **No shared design language** — This page uses standard shadcn/ui cards without the amber-gradient, indigo-hero treatment used on the main landing page. It feels like a different product.

---

### 3.6 Universities (`/universities`)

**Issues:**

1. **Extremely thin stub** — Just a heading, a description, two cards ("Curriculum → Capability" and "Career Alignment"), and a mailto link. No header, no footer, no pricing, no CTA funnel.

2. **The landing page pricing section** links "Contact Us" → `/universities`. Visitors expecting an enterprise pitch page get a barebones stub. This is a conversion cliff.

3. **No back navigation** to landing page other than a "Back to Home" button.

---

### 3.7 404 Page

Minimal and functional. Plain centered "404 / Oops! Page not found / Return to Home". Uses anchor tag `<a>` instead of `<Link>` which causes a full page reload. Low priority.

---

## 4. Cross-Cutting Issues

### 4.1 Font Loading (Performance)
`index.css` imports 7 Google Font families via separate `@import url()` calls:
- Plus Jakarta Sans
- Inter (imported twice)
- Space Grotesk
- Lora
- Space Mono (imported twice)
- Roboto
- Libre Caslon Text
- Roboto Mono

The tailwind config only uses Roboto, Inter, Libre Caslon Text, and Roboto Mono. The others (Plus Jakarta Sans, Space Grotesk, Lora, Space Mono) are unused. This adds ~200-400ms to initial page load for fonts that are never rendered.

### 4.2 Coral Class Remnants
The CSS defines amber (`--amber-300/400/500`) but the code uses `coral-*` classes extensively in:
- `HeroSection.tsx` (lines 39, 77, 91, 107, 146, 157, etc.)
- `CTASection.tsx` (lines 11, 17, 27, etc.)

These classes aren't defined in `tailwind.config.ts`. They rely on a Tailwind JIT arbitrary value or simply don't render. This needs investigation — if `coral-*` is not a registered color, these styles silently fail.

### 4.3 Inconsistent Logo Usage
The `<Logo />` component (in `components/common/Logo.tsx`) has a carefully crafted SVG icon with the stacked box and S shape. But it's only used in the landing page Header and Footer. Other pages use:
- Auth: `GraduationCap` icon + plain text
- Onboarding: `Sparkles` icon + plain text
- Employers: plain `S` in a box + plain text
- Universities: no logo at all

### 4.4 Duplicate Form Libraries
The codebase has two form libraries:
- `react-hook-form` (used by the active `Auth.tsx`)
- `@tanstack/react-form` (used by unused `LoginForm.tsx` and `SignupForm.tsx`)

Both are in `package.json` dependencies and shipped in the bundle.

---

## 5. Proposed Revision Plan with Wireframes

### 5.1 Landing Page — Revised Structure

**Goal:** Sharpen the value proposition, remove duplicate toggles, add social proof, fix the conversion funnel.

```
BEFORE                              AFTER
┌────────────────────┐              ┌────────────────────┐
│ Header             │              │ Header             │
│ (no audience link) │              │ + "For Educators"  │
│                    │              │   nav link          │
├────────────────────┤              ├────────────────────┤
│                    │              │                    │
│ HERO               │              │ HERO               │
│ min-h-screen       │              │ py-24 (NOT full    │
│ 2 audience toggles │              │ screen)            │
│                    │              │                    │
│ Student headline   │              │ Student-first      │
│ OR Instructor      │              │ headline           │
│ headline           │              │ (single audience)  │
│                    │              │                    │
│ [Start Analysis]   │              │ [Start Free] →     │
│ [See How It Works] │              │   /auth?role=      │
│                    │              │   student           │
│                    │              │ [I'm an Educator →] │
│                    │              │   /auth?role=       │
│                    │              │   instructor        │
├────────────────────┤              ├────────────────────┤
│                    │              │ TRUST BAR           │
│ (nothing)          │              │ "Used by X students │
│                    │              │  at Y universities" │
│                    │              │ (or "New platform"  │
│                    │              │  with honest framing│
│                    │              │  if no real stats)  │
├────────────────────┤              ├────────────────────┤
│ FEATURES           │              │ FEATURES            │
│ (with toggle)      │              │ Student features    │
│                    │              │ (no toggle here,    │
│                    │              │  instructor features│
│                    │              │  live on /teach     │
│                    │              │  or /for-educators) │
├────────────────────┤              ├────────────────────┤
│ HOW IT WORKS       │              │ HOW IT WORKS       │
│ (with toggle)      │              │ Student flow only   │
│ 2x2 grid           │              │ 4 steps, vertical   │
│                    │              │ timeline            │
├────────────────────┤              ├────────────────────┤
│ TESTIMONIALS       │              │ SOCIAL PROOF       │
│ (returns null)     │              │ Early adopter       │
│                    │              │ quotes OR "Built by │
│                    │              │ [team], backed by   │
│                    │              │ [fact]"             │
├────────────────────┤              ├────────────────────┤
│ PRICING            │              │ PRICING            │
│ (mixed audience)   │              │ Student pricing     │
│                    │              │ only. Link to       │
│                    │              │ educator pricing    │
│                    │              │ on /for-educators   │
├────────────────────┤              ├────────────────────┤
│ CTA                │              │ CTA                │
│ "Stop Guessing"    │              │ "See where you     │
│                    │              │  stand. Start free."│
├────────────────────┤              ├────────────────────┤
│ FOOTER             │              │ FOOTER             │
│                    │              │ (unchanged)        │
└────────────────────┘              └────────────────────┘
```

**Changes required:**

| File | Change | Diff Size |
|------|--------|-----------|
| `HeroSection.tsx` | Remove audience toggle. Make student-focused. Add a secondary CTA linking to `/for-educators`. Reduce height from `min-h-screen` to `py-24 lg:py-32`. Fix coral→amber class names. | ~80 lines |
| `FeaturesSection.tsx` | Remove audience toggle. Show student features only. | ~30 lines |
| `HowItWorksSection.tsx` | Remove audience toggle. Student flow only. Consider vertical timeline instead of 2x2 grid. | ~40 lines |
| `TestimonialsSection.tsx` | Replace `null` return with honest social proof section (founding team, backed by, or early user quotes). | ~60 lines new |
| `PricingSection.tsx` | Remove University tier. Show Free + Pro for students. Add "For educators, see pricing" link. | ~20 lines |
| `CTASection.tsx` | Simplify copy to student-focused. Fix coral→amber. | ~10 lines |
| `Header.tsx` | Add "For Educators" nav link pointing to `/for-educators` or `/teach`. | ~5 lines |

### 5.2 Auth Page — Revised Structure

```
BEFORE                              AFTER
┌──────────┬───────────┐           ┌──────────┬───────────┐
│          │           │           │          │           │
│ GradCap  │ [Login]   │           │ <Logo /> │ [Login]   │
│ icon     │ [Signup]  │           │ component│ [Signup]  │
│          │           │           │          │           │
│ Generic  │ Email     │           │ Dynamic  │ Email     │
│ student  │ Password  │           │ copy per │ Password  │
│ copy     │           │           │ ?role=   │           │
│          │ [Log In]  │           │ param    │ [Log In]  │
│          │           │           │          │           │
│ ✓ AI     │           │           │ ✓ Feat 1 │           │
│ ✓ Gaps   │           │           │ ✓ Feat 2 │           │
│ ✓ Recs   │           │           │ ✓ Feat 3 │           │
│          │           │           │          │           │
└──────────┴───────────┘           └──────────┴───────────┘
```

**Changes required:**

| File | Change | Diff Size |
|------|--------|-----------|
| `Auth.tsx` | Import and use `<Logo />` instead of `GraduationCap`. Read `?role=` query param to show instructor vs student messaging on left panel. | ~25 lines |

### 5.3 Onboarding — Revised Structure

```
BEFORE                              AFTER
┌────────────────────┐              ┌────────────────────┐
│ Sparkles +         │              │ <Logo /> +         │
│ "SyllabusStack"    │              │ Step X of N        │
├────────────────────┤              ├────────────────────┤
│ Same 4 steps       │              │ Role-aware steps:  │
│ for everyone:      │              │                    │
│ 1. Profile         │              │ STUDENT:           │
│ 2. Courses         │              │ 1. Profile         │
│ 3. Dream Jobs      │              │ 2. Upload Courses  │
│ 4. Complete        │              │ 3. Dream Jobs      │
│                    │              │ 4. Complete        │
│                    │              │                    │
│                    │              │ INSTRUCTOR:        │
│                    │              │ 1. Profile         │
│                    │              │ 2. Upload Syllabus │
│                    │              │ 3. Review Course   │
│                    │              │ 4. Complete        │
├────────────────────┤              ├────────────────────┤
│ No skip option     │              │ "Skip for now"     │
│                    │              │ link on steps 2/3  │
└────────────────────┘              └────────────────────┘
```

**Changes required:**

| File | Change | Diff Size |
|------|--------|-----------|
| `OnboardingWizard.tsx` | Use `<Logo />` in header. Add skip links on course/dream-job steps. | ~20 lines |
| `Onboarding.tsx` (page) | Use `<Logo />` instead of manual text rendering. | ~5 lines |
| Future: Role-aware onboarding | Larger feature — detect user role and branch wizard steps. Out of scope for this pass but flagged. | N/A |

### 5.4 Employers Page — Revised Structure

```
BEFORE                              AFTER
┌────────────────────┐              ┌────────────────────┐
│ Custom nav with    │              │ Shared <Header />  │
│ plain "S" logo     │              │ with <Logo />      │
├────────────────────┤              ├────────────────────┤
│ Fake stats bar:    │              │ Remove stats bar   │
│ 50K+ certs, etc.   │              │ OR replace with    │
│                    │              │ honest numbers     │
├────────────────────┤              ├────────────────────┤
│ Features (good)    │              │ Features (keep)    │
├────────────────────┤              ├────────────────────┤
│ How It Works (good)│              │ How It Works (keep)│
├────────────────────┤              ├────────────────────┤
│ API Preview (good) │              │ API Preview (keep) │
├────────────────────┤              ├────────────────────┤
│ 3-tier pricing     │              │ Simplify to        │
│ (premature)        │              │ "Contact us" or    │
│                    │              │ "Coming soon"      │
├────────────────────┤              ├────────────────────┤
│ Custom footer      │              │ Shared <Footer />  │
└────────────────────┘              └────────────────────┘
```

**Changes required:**

| File | Change | Diff Size |
|------|--------|-----------|
| `Employers.tsx` | Replace custom nav with `<Header />`. Replace custom footer with `<Footer />`. Remove or flag fake stats. Simplify pricing. | ~60 lines |

### 5.5 Universities Page — Revised Structure

```
BEFORE                              AFTER
┌────────────────────┐              ┌────────────────────┐
│ No header          │              │ Shared <Header />  │
├────────────────────┤              ├────────────────────┤
│ H1 + 2 line desc   │              │ Hero section with  │
│                    │              │ "SyllabusStack for │
│ [Back] [Contact]   │              │  Universities"     │
│                    │              │ + subtitle + CTA   │
├────────────────────┤              ├────────────────────┤
│ 2 cards:           │              │ 4-6 value prop     │
│ Capability         │              │ cards:             │
│ Career Alignment   │              │ - Curriculum map   │
│                    │              │ - Career alignment │
│                    │              │ - Cohort analytics │
│                    │              │ - Instructor tools │
│                    │              │ - Custom branding  │
│                    │              │ - Admin dashboard  │
├────────────────────┤              ├────────────────────┤
│ (nothing)          │              │ Contact/CTA section│
│                    │              │ "Schedule a demo"  │
├────────────────────┤              ├────────────────────┤
│ No footer          │              │ Shared <Footer />  │
└────────────────────┘              └────────────────────┘
```

**Changes required:**

| File | Change | Diff Size |
|------|--------|-----------|
| `Universities.tsx` | Full rewrite — add Header, hero, expanded value props, CTA section, Footer. | ~150 lines |

### 5.6 Global CSS / Performance — Changes

| File | Change | Diff Size |
|------|--------|-----------|
| `index.css` | Remove unused font imports (Plus Jakarta Sans, Space Grotesk, Lora, Space Mono). Keep only Roboto, Inter, Libre Caslon Text, Roboto Mono. Add `coral-*` color definitions OR replace all coral refs with amber. | ~10 lines removed |
| `tailwind.config.ts` | Add `coral` color aliases pointing to amber values (if keeping coral class names) OR do a project-wide find/replace. | ~5 lines |

### 5.7 Dead Code Cleanup

| File | Action |
|------|--------|
| `src/components/auth/LoginForm.tsx` | Delete — unused, uses different form library |
| `src/components/auth/SignupForm.tsx` | Delete — unused, uses different form library |
| `src/components/auth/index.ts` | Update exports to remove deleted components |

---

## 6. Impact Assessment & File Map

### Files Modified (by priority)

**P0 — High impact, fix first:**

| File | Lines Changed (est.) | Risk |
|------|---------------------|------|
| `src/components/landing/HeroSection.tsx` | ~80 | Medium — core landing visual |
| `src/components/landing/TestimonialsSection.tsx` | ~60 new | Low — currently returns null |
| `src/pages/Universities.tsx` | ~150 rewrite | Low — currently a stub |
| `src/index.css` | ~10 removed | Low — removing unused fonts |

**P1 — Medium impact:**

| File | Lines Changed (est.) | Risk |
|------|---------------------|------|
| `src/components/landing/FeaturesSection.tsx` | ~30 | Low |
| `src/components/landing/HowItWorksSection.tsx` | ~40 | Low |
| `src/components/landing/PricingSection.tsx` | ~20 | Low |
| `src/components/landing/CTASection.tsx` | ~10 | Low |
| `src/components/landing/Header.tsx` | ~5 | Low |
| `src/pages/Auth.tsx` | ~25 | Medium — auth flow |
| `src/pages/Employers.tsx` | ~60 | Low |

**P2 — Low impact / cleanup:**

| File | Lines Changed (est.) | Risk |
|------|---------------------|------|
| `src/pages/Onboarding.tsx` | ~5 | Low |
| `src/components/onboarding/OnboardingWizard.tsx` | ~20 | Low |
| `src/pages/NotFound.tsx` | ~2 | None |
| `src/components/auth/LoginForm.tsx` | DELETE | None |
| `src/components/auth/SignupForm.tsx` | DELETE | None |
| `tailwind.config.ts` | ~5 | Low |

### Total Estimated Diff

- **~15 files touched**
- **~500-600 lines changed** (including the Universities page rewrite)
- **~300 lines removed** (dead code, unused fonts)
- **0 new files** (all changes are to existing files)

### No Behavioral Changes To:

- Auth flow logic (login/signup/Supabase integration)
- Onboarding data persistence (localStorage)
- Routing structure
- Protected routes
- Admin/instructor/student dashboards
- API calls or backend integration

---

## Summary of Recommendations (Ranked)

1. **Remove audience toggles from landing page** — Make it student-first, with a clear "For Educators" nav link and separate page
2. **Fix hero height** — `py-24` instead of `min-h-screen` so features are visible above the fold
3. **Add social proof section** — Replace null Testimonials with honest early-stage proof
4. **Fix coral→amber color references** — Ensure all accent colors render correctly
5. **Rebuild Universities page** — Current stub hurts conversion from pricing CTA
6. **Unify nav/footer** — Employers page should use shared Header/Footer
7. **Use Logo component everywhere** — Auth, Onboarding, Employers all need the real logo
8. **Clean up fonts** — Remove 4 unused Google Font imports
9. **Delete dead form components** — LoginForm.tsx and SignupForm.tsx
10. **Add role awareness to Auth page** — Read `?role=` param, show relevant left-panel copy
