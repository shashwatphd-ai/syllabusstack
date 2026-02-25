

## Copy Audit: Every Marketing Statement Across Landing Pages

Here's every piece of marketing copy, organized by where it appears, with duplicates and fluff flagged.

---

### Full Inventory

```text
LOCATION                    COPY                                                          FLAG
─────────────────────────── ───────────────────────────────────────────────────────────── ──────────
HEADER
  CTA buttons               "Log In" / "Get Started"                                      OK

HERO (Student)
  H1                        "See How Your Coursework Maps to Jobs"                         OK
  Subhead                   "Upload your coursework, add your dream jobs, and get          FLUFF — 3 actions
                             AI-powered skill mapping showing exactly where you             crammed into one
                             stand—and what to do next."                                    sentence
  CTA 1                     "Start Your Analysis"                                          OK
  CTA 2                     "See How It Works"                                             OK
  Trust 1                   "Free to start"                                                DUPE → CTA section
  Trust 2                   "Pay per action or subscribe"                                  DUPE → Pricing
  Trust 3                   "No resume needed"                                             OK
  Float card 1              "Gap Analysis / See what's missing"                            DUPE → Features #2
  Float card 2              "Action Plan / Know what to do next"                           DUPE → Features #3

HERO (Instructor)
  H1                        "Turn Your Syllabus Into a Video Course"                       OK
  Subhead                   "Upload your syllabus. We match each topic with quality         OK
                             video content. Your students get structured, engaging
                             content that builds real skills."
  CTA 1                     "Create Your Course"                                           OK
  CTA 2                     "See How It Works"                                             DUPE → same as student
  Trust 1                   "$1 per course, or unlimited with Pro"                         DUPE → Pricing
  Trust 2                   "Ready in minutes"                                             OK
  Trust 3                   "Built-in comprehension checks"                                DUPE → Features #3

FEATURES (Student)
  Section badge             "Features"                                                     OK
  Section H2                "What You Get"                                                 OK
  Section sub               "Simple tools that show you where you are and what to do next." DUPE → Hero subhead
  Card 1 title              "Upload Your Courses"                                          DUPE → HowItWorks step 1
  Card 1 desc               "Add your syllabi and see what skills you've actually           OVERLAP → HowItWorks #1
                             built—not just course names, but what you can do."
  Card 2 title              "See Where You Stand"                                          DUPE → Hero "where you stand"
  Card 2 desc               "Compare your skills to real job requirements. Find out         OK
                             what's missing before you apply."
  Card 3 title              "Know What to Do Next"                                         DUPE → Hero "what to do next"
  Card 3 desc               "Get specific steps: which courses, tutorials, or projects      OVERLAP → HowItWorks #4
                             will close your gaps fastest."
  Card 4 title              "Track Your Progress"                                          OK
  Card 4 desc               "See how each action moves you closer to your goal.             FLUFF — vague
                             Know when you're ready."

FEATURES (Instructor)
  Card 1 title              "Upload Your Syllabus"                                         DUPE → HowItWorks #1
  Card 1 desc               "Paste or upload your syllabus. We turn it into clear           DUPE → HowItWorks #1
                             learning goals your students can follow."
  Card 2 title              "Videos Matched to Your Course"                                DUPE → HowItWorks #2
  Card 2 desc               "Each topic gets matched with quality YouTube content.          DUPE → HowItWorks #2
                             Review it or let it run automatically."
  Card 3 title              "Built-In Comprehension Checks"                                DUPE → Hero trust #3
  Card 3 desc               "Short questions during videos reinforce key concepts           DUPE → HowItWorks #3
                             and confirm understanding."
  Card 4 title              "Measure Learning Outcomes"                                    OK
  Card 4 desc               "See which topics are clicking and where your course             OK
                             can improve."

HOW IT WORKS (Student)
  Section badge             "How It Works"                                                 OK
  Section H2                "From Confusion to Clarity"                                    FLUFF — abstract
  Section sub               "Four simple steps to understand exactly where you stand        DUPE → Features sub
                             and what to do next."
  Step 1                    "Upload Your Courses" + desc                                   DUPE → Features #1
  Step 2                    "Add Dream Jobs" + desc                                        OK (unique)
  Step 3                    "Get Gap Analysis" + desc                                      DUPE → Features #2
  Step 4                    "Follow Your Plan" + desc                                      DUPE → Features #3

HOW IT WORKS (Instructor)
  Section sub               "Four simple steps to turn your syllabus into an engaging,      OK
                             structured video course."
  Step 1                    "Upload Your Syllabus"                                         DUPE → Features #1
  Step 2                    "Videos Get Matched"                                           DUPE → Features #2
  Step 3                    "Students Learn Actively"                                      DUPE → Features #3
  Step 4                    "Measure Outcomes"                                             DUPE → Features #4

TESTIMONIALS / WHY SECTION
  Section badge             "Why SyllabusStack"                                            OK
  Section H2                "Simple, Smart, Honest"                                        OK
  Section sub               "We built SyllabusStack because career readiness                FLUFF — "we built X
                             shouldn't be a guessing game."                                 because" is filler
  Card 1                    "Honest by Design / No fake metrics..."                        OK
  Card 2                    "AI-Powered Analysis / ...not guesswork or self-reported"       OK
  Card 3                    "Actionable, Not Decorative / Every insight comes with           DUPE → Features #3
                             a next step. We don't just diagnose gaps—we tell you
                             how to close them."
  Card 4                    "Built for Learners / Created by people who believe              FLUFF — "created by
                             education should connect to careers, not just credentials."     people who believe"

PRICING
  Section H2                "Pricing"                                                      OK
  Section sub               "Free to start. Pro when you're ready."                        DUPE → Hero trust #1
  Free tagline              "Pay as you go."                                                OK
  Pro tagline               "No per-action fees."                                          OK
  University tagline        "For institutions."                                            OK
  Footnote                  "Free tier charges $1 per course you create."                  DUPE → Hero instructor trust #1

CTA SECTION
  Badge                     "Try Free Today"                                               DUPE → Hero trust #1
  H2                        "Stop Guessing. Start Knowing."                                FLUFF — abstract
  Subhead                   "Whether you're a student finding your career path or an        FLUFF — restates
                             educator building engaging courses—SyllabusStack has            what's already been
                             you covered."                                                  said 3x
  CTA                       "Get Started Free"                                             DUPE → Header CTA
  Trust 1                   "Free to get started"                                          DUPE → Hero trust #1 (4th time)
  Trust 2                   "Pro removes all limits"                                       OK
  Trust 3                   "No credit card required"                                      OK (new info)

FOOTER
  Tagline                   "The platform that bridges what you've learned to where          FLUFF — identified
                             you're going."                                                 by user
  Bottom line               "Built for learners and educators."                            DUPE → Testimonials #4

AUTH (Student)
  Headline                  "Transform Your Education Into Career Readiness"                FLUFF — abstract
  Description               "SyllabusStack helps you connect your coursework to your        DUPE → Hero subhead
                             dream job through AI-powered analysis and personalized
                             recommendations."
  Feature 1                 "AI-powered syllabus analysis"                                 DUPE → Testimonials #2
  Feature 2                 "Personalized skill gap identification"                        DUPE → Features #2
  Feature 3                 "Smart course recommendations"                                 DUPE → Features #3

AUTH (Instructor)
  Headline                  "Turn Your Syllabus Into an Engaging Video Course"              DUPE → Hero H1
  Description               "Upload your syllabus and we'll match each topic with           DUPE → Hero subhead
                             quality video content, complete with built-in
                             comprehension checks."
  Feature 1                 "AI-powered content matching"                                  DUPE → Features #2
  Feature 2                 "Built-in comprehension checks"                                DUPE → Features #3 (5th time)
  Feature 3                 "Learning outcome analytics"                                   DUPE → Features #4
```

---

### Summary of Problems

**"Free to start" is said 4 times:** Hero trust, Pricing sub, CTA badge, CTA trust.

**"Where you stand / what to do next" is said 5 times:** Hero subhead, Features sub, Features cards #2/#3, HowItWorks sub.

**"Built-in comprehension checks" is said 5 times:** Hero instructor trust, Features #3, HowItWorks #3, Auth feature #2, and implicitly in Auth description.

**Features and HowItWorks are near-identical:** All 4 feature cards for both audiences are restated as the 4 HowItWorks steps. The sections say the same thing twice with slightly different formatting.

**The CTA section restates the entire page** in 4 lines.

**Auth page restates the Hero** almost verbatim.

**Footer tagline** is the fluff statement the user identified.

---

### Proposed Fix: What Each Section Should Say (Once)

```text
SECTION          JOB                              SAY THIS (ONCE)
──────────────── ──────────────────────────────── ─────────────────────────────────────
Hero             What is this + primary CTA        H1 + 1-line subhead + CTA button
Features         What specifically do I get         4 concrete capabilities (no overlap
                                                    with HowItWorks)
HowItWorks       What's the process                 4 steps (actions, not benefits)
Why Section      Why should I trust this             Trust signals only
Pricing          What does it cost                   Tiers + prices
CTA              Final push                          1 line + button (no re-explanation)
Footer           Brand sign-off                      Short tagline (the one we're fixing)
Auth             Reinforce decision                   1 line + role-relevant features
```

### Specific Copy Changes (10 files)

| # | File | Current | Proposed | Why |
|---|------|---------|----------|-----|
| 1 | `Footer.tsx` L17 | "The platform that bridges what you've learned to where you're going." | "Connect your courses to your career." | User-identified fluff |
| 2 | `HeroSection.tsx` L154-157 | "Upload your coursework, add your dream jobs, and get AI-powered skill mapping showing exactly where you stand—and what to do next." | "Upload your courses. Add your dream jobs. See exactly where the gaps are." | Shorter, 3 punchy sentences |
| 3 | `HeroSection.tsx` L175-183 | Trust badges: "Free to start" / "Pay per action or subscribe" / "No resume needed" | "Free to start" / "No credit card required" / "No resume needed" | Remove pricing detail (said in Pricing section); add "no CC" here instead of CTA |
| 4 | `HeroSection.tsx` L222-233 | Instructor trust badges including "Built-in comprehension checks" | "$1 per course, or unlimited with Pro" / "Ready in minutes" / "No slides needed" | Remove comprehension checks (said in Features) |
| 5 | `FeaturesSection.tsx` L80-82 | "Simple tools that show you where you are and what to do next." | "Everything you need, nothing you don't." | Remove "where you stand / what to do next" (said in Hero) |
| 6 | `HowItWorksSection.tsx` L259-268 | "From Confusion to Clarity" + "Four simple steps..." | "How It Works" + "Here's what happens after you sign up." | Remove abstract metaphor; be literal |
| 7 | `TestimonialsSection.tsx` L41-43 | "We built SyllabusStack because career readiness shouldn't be a guessing game." | "Here's what makes us different." | Remove "we built X because" filler |
| 8 | `TestimonialsSection.tsx` Card 3 desc | "Every insight comes with a next step. We don't just diagnose gaps—we tell you how to close them." | "Every report includes specific next steps with time estimates and costs." | Remove "not just X, but Y" pattern; be concrete |
| 9 | `TestimonialsSection.tsx` Card 4 desc | "Created by people who believe education should connect to careers, not just credentials." | "Designed around how students actually learn and job-hunt." | Remove "created by people who believe" |
| 10 | `CTASection.tsx` L23-31 | "Stop Guessing. Start Knowing." + full paragraph restating both audiences | "See where you stand." + "Free to start. No credit card required." | Kill the re-explanation entirely |
| 11 | `Auth.tsx` L43-44 | "Transform Your Education Into Career Readiness" + long description | "Your courses. Your dream jobs. Your gap analysis." + "Sign in to get started." | Don't re-explain the product on the login page |
| 12 | `Auth.tsx` L53-54 | "Turn Your Syllabus Into an Engaging Video Course" + long description | "Syllabus in. Video course out." + "Sign in to create your first course." | Same — short and direct |
| 13 | `Footer.tsx` L87-88 | "Built for learners and educators." | Remove entirely (or keep, it's fine as a sign-off) | Redundant with card #4 in Why section |

Total: 10 files, ~40 lines of copy changes. No structural or logic changes.

