import { forwardRef, useState } from "react";
import { Upload, Search, CheckCircle, Rocket, FileText, Video, Users, BarChart3, GraduationCap, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type Audience = "students" | "instructors";

const studentSteps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your Courses",
    description: "Add your course syllabi—PDF, DOCX, or paste text. We identify the skills you've built.",
    visual: (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl p-5 border border-primary/10 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div className="text-base font-semibold text-foreground">Financial Modeling 301</div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-sm text-muted-foreground">3-statement model building</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-sm text-muted-foreground">Excel proficiency (advanced)</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-sm text-muted-foreground">DCF valuation basics</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    icon: Search,
    title: "Add Dream Jobs",
    description: "Tell us what roles you want. Product Manager? Investment Banking? We analyze real requirements.",
    visual: (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl p-5 border border-primary/10 shadow-lg">
        <div className="text-sm text-muted-foreground mb-1">Dream Job</div>
        <div className="text-base font-bold text-foreground mb-4">Product Manager @ Tech</div>
        <div className="text-sm text-muted-foreground mb-3">Day-One Requirements:</div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg font-medium">SQL queries</span>
          <span className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg font-medium">PRD writing</span>
          <span className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg font-medium">A/B testing</span>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    icon: CheckCircle,
    title: "Get Gap Analysis",
    description: "See exactly where you're strong, where you're weak, and what would actually get you filtered out.",
    visual: (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl p-5 border border-primary/10 shadow-lg">
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-success font-medium">Strong Overlap</span>
            <span className="text-muted-foreground">4 areas</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-success to-emerald-400 w-2/3 rounded-full" />
          </div>
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-warning font-medium">Partial Match</span>
            <span className="text-muted-foreground">2 areas</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-warning to-amber-400 w-1/3 rounded-full" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-destructive font-medium">Critical Gaps</span>
            <span className="text-muted-foreground">2 areas</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-destructive to-red-400 w-1/4 rounded-full" />
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "04",
    icon: Rocket,
    title: "Follow Your Plan",
    description: "Get specific, actionable recommendations with time estimates, costs, and evidence you can show.",
    visual: (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl p-5 border border-primary/10 shadow-lg">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-400 flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-sm font-bold text-amber-950">1</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Mode Analytics SQL Course</div>
              <div className="text-sm text-muted-foreground">15 hrs • Free • Closes data gap</div>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-400 flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-sm font-bold text-amber-950">2</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Build a PRD for real product</div>
              <div className="text-sm text-muted-foreground">8 hrs • Free • Portfolio evidence</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

const instructorSteps = [
  {
    number: "01",
    icon: FileText,
    title: "Upload Your Syllabus",
    description: "Paste or upload your syllabus. We turn it into clear topics your students can follow.",
    visual: (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl p-5 border border-primary/10 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="text-base font-semibold text-foreground">CS 101: Intro to Programming</div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-sm text-muted-foreground">12 topics ready to go</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-sm text-muted-foreground">Organized by difficulty</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    icon: Video,
    title: "Videos Get Matched",
    description: "Each topic gets matched with quality YouTube videos. Review them or let it run automatically.",
    visual: (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl p-5 border border-primary/10 shadow-lg">
        <div className="text-sm text-muted-foreground mb-3">For: "Understand variables and data types"</div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-background rounded-lg border-2 border-primary/30 shadow-sm">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <span className="text-sm text-primary font-bold">▶</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Variables Explained (12:34)</div>
              <div className="text-sm text-muted-foreground">Coding Tutorial Channel • High match</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
              <span className="text-sm text-muted-foreground">▶</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Data Types Deep Dive (8:22)</div>
              <div className="text-sm text-muted-foreground">Programming Basics • Good match</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    icon: Users,
    title: "Students Learn Verifiably",
    description: "Students watch with micro-checks that prevent skipping. You know they actually engaged.",
    visual: (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl p-5 border border-primary/10 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-foreground">Micro-Check @ 5:30</div>
          <span className="px-3 py-1 text-sm bg-success/10 text-success rounded-full font-medium">Passed</span>
        </div>
        <div className="text-sm text-muted-foreground mb-3">
          "What is the output of: x = 5; print(x + 2)?"
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1.5 text-sm bg-muted rounded-lg">5</span>
          <span className="px-3 py-1.5 text-sm bg-success/20 text-success rounded-lg border border-success font-medium">7 ✓</span>
          <span className="px-3 py-1.5 text-sm bg-muted rounded-lg">52</span>
        </div>
      </div>
    ),
  },
  {
    number: "04",
    icon: BarChart3,
    title: "Track Mastery",
    description: "See which students are struggling, what content works, and who's ready for final assessments.",
    visual: (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl p-5 border border-primary/10 shadow-lg">
        <div className="text-sm font-semibold text-foreground mb-4">Class Progress</div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Module 1</span>
              <span className="text-sm text-success font-medium">92% complete</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-success to-emerald-400 w-[92%] rounded-full" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Module 2</span>
              <span className="text-sm text-amber-500 font-medium">45% complete</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 w-[45%] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export const HowItWorksSection = forwardRef<HTMLElement>(function HowItWorksSection(_props, ref) {
  const [audience, setAudience] = useState<Audience>("students");
  const steps = audience === "students" ? studentSteps : instructorSteps;

  return (
    <section ref={ref} id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl opacity-50" />

      <div className="container mx-auto px-6 relative">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
            How It Works
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            From Confusion to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-400">Clarity</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            {audience === "students" 
              ? "Four simple steps to understand exactly where you stand and what to do next."
              : "Four simple steps to turn your syllabus into an engaging, trackable video course."
            }
          </p>
        </div>

        {/* Audience toggle */}
        <div className="flex justify-center mb-16">
          <div className="inline-flex items-center gap-1 p-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border shadow-lg">
            <button
              onClick={() => setAudience("students")}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all",
                audience === "students"
                  ? "bg-gradient-to-r from-amber-500 to-amber-400 text-amber-950 shadow-lg shadow-amber-500/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <GraduationCap className="w-4 h-4" />
              For Students
            </button>
            <button
              onClick={() => setAudience("instructors")}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all",
                audience === "instructors"
                  ? "bg-gradient-to-r from-amber-500 to-amber-400 text-amber-950 shadow-lg shadow-amber-500/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <BookOpen className="w-4 h-4" />
              For Educators
            </button>
          </div>
        </div>

        {/* Steps with sequential flow */}
        <div id="how-it-works-instructor" className="relative max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-x-16 gap-y-12">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="group relative flex gap-6 items-start"
              >
                {/* Number badge */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform">
                    <span className="text-xl font-bold text-primary-foreground">{step.number}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                      <step.icon className="w-5 h-5 text-primary" />
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-base text-muted-foreground mb-5 leading-relaxed">
                    {step.description}
                  </p>
                  {step.visual}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

HowItWorksSection.displayName = "HowItWorksSection";
