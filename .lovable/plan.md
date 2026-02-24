

## Simplify Messaging: Landing Page + Skills Assessment

### 1. Landing Page -- Reframe Educator Copy (3 files)

Remove all surveillance/tracking language and replace with learning-outcomes framing. Also remove technical methodology references that give away how the system works.

**`src/components/landing/HeroSection.tsx`**
- Floating card: "See Who's Learning" / "Know who needs help" --> "Learning Outcomes" / "Measure what matters"
- Subheadline: "See exactly who's learning and who needs help" --> "Your students get structured, engaging content that builds real skills."
- Trust indicator: "Track who's actually watching" --> "Built-in comprehension checks"

**`src/components/landing/FeaturesSection.tsx`**
- Feature #3: "Know They Actually Watched" --> "Built-In Comprehension Checks"; description reframed to "reinforce key concepts" instead of "confirm attention"
- Feature #4: "See Who Needs Help" --> "Measure Learning Outcomes"; description reframed to "see which topics are clicking" instead of "know which students are struggling"

**`src/components/landing/HowItWorksSection.tsx`**
- Step 3: "Students Learn Verifiably" --> "Students Learn Actively"; description drops "prevent skipping" for "reinforce key concepts"
- Step 4: "Track Mastery" --> "Measure Outcomes"; description drops "struggling" for "which topics are landing"
- Subtitle: "trackable video course" --> "structured video course"

### 2. Skills Assessment Wizard -- Remove Methodology Cards

**`src/components/skills-assessment/SkillsAssessmentWizard.tsx`**

Remove the entire 3-column grid that exposes "Holland RIASEC," "35 O*NET Skills," and "Work Values." Replace with a single, simpler description line:

```text
BEFORE (3 detailed cards):
  Holland RIASEC | 35 O*NET Skills | Work Values
  + descriptions of each methodology

AFTER (clean, simple):
  A short description paragraph like:
  "Answer questions about your interests, skills, and what matters
   to you at work. We'll match you with careers that fit."
```

This keeps the value proposition ("find careers that fit") without disclosing the specific frameworks and data sources used.

### Summary of Framing Shifts

```text
BEFORE                              AFTER
------------------------------      ------------------------------
Track who's watching           -->  Built-in comprehension checks
See who needs help             -->  Measure learning outcomes
Know they actually watched     -->  Built-in comprehension checks
Students learn verifiably      -->  Students learn actively
Track mastery                  -->  Measure outcomes
Prevent skipping               -->  Reinforce key concepts
Trackable video course         -->  Structured video course
Holland RIASEC / O*NET / ...   -->  (removed, simplified description)
```

All changes are copy-only -- no logic, no structural, no dependency changes. 4 files updated total.
