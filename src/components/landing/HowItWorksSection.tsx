import { Upload, Search, CheckCircle, Rocket, FileText, Video, Users, BarChart3, GraduationCap, BookOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Audience = "students" | "instructors";

const studentSteps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your Courses",
    description: "Add your course syllabi—PDF, DOCX, or paste text. Our AI extracts what you actually learned.",
    visual: (
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-coral-500/10 flex items-center justify-center">
            <Upload className="w-4 h-4 text-coral-500" />
          </div>
          <div className="text-sm font-medium text-foreground">Financial Modeling 301</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-success" />
            <span className="text-xs text-muted-foreground">3-statement model building</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-success" />
            <span className="text-xs text-muted-foreground">Excel proficiency (advanced)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-success" />
            <span className="text-xs text-muted-foreground">DCF valuation basics</span>
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
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <div className="text-xs text-muted-foreground mb-2">Dream Job</div>
        <div className="text-sm font-semibold text-foreground mb-3">Product Manager @ Tech</div>
        <div className="text-xs text-muted-foreground mb-2">Day-One Requirements:</div>
        <div className="flex flex-wrap gap-1">
          <span className="px-2 py-1 text-xs bg-coral-500/10 text-coral-500 rounded-md">SQL queries</span>
          <span className="px-2 py-1 text-xs bg-coral-500/10 text-coral-500 rounded-md">PRD writing</span>
          <span className="px-2 py-1 text-xs bg-coral-500/10 text-coral-500 rounded-md">A/B testing</span>
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
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-success">Strong Overlap</span>
            <span className="text-muted-foreground">4 areas</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-success w-2/3 rounded-full" />
          </div>
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-warning">Partial Match</span>
            <span className="text-muted-foreground">2 areas</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-warning w-1/3 rounded-full" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-destructive">Critical Gaps</span>
            <span className="text-muted-foreground">2 areas</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-destructive w-1/4 rounded-full" />
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
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-coral-500">1</span>
            </div>
            <div>
              <div className="text-xs font-medium text-foreground">Mode Analytics SQL Course</div>
              <div className="text-xs text-muted-foreground">15 hrs • Free • Closes data gap</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-coral-500">2</span>
            </div>
            <div>
              <div className="text-xs font-medium text-foreground">Build a PRD for real product</div>
              <div className="text-xs text-muted-foreground">8 hrs • Free • Portfolio evidence</div>
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
    description: "Paste or upload your syllabus. Our AI parses it and extracts structured learning objectives.",
    visual: (
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-coral-500/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-coral-500" />
          </div>
          <div className="text-sm font-medium text-foreground">CS 101: Intro to Programming</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-success" />
            <span className="text-xs text-muted-foreground">12 learning objectives extracted</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-success" />
            <span className="text-xs text-muted-foreground">Bloom's levels identified</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    icon: Video,
    title: "AI Curates Content",
    description: "For each objective, AI finds and ranks the best YouTube videos. You review or auto-approve.",
    visual: (
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <div className="text-xs text-muted-foreground mb-2">For: "Understand variables and data types"</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-background rounded-lg border border-coral-500/30">
            <div className="w-6 h-6 rounded bg-coral-500/20 flex items-center justify-center">
              <span className="text-xs text-coral-500">▶</span>
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium">Variables Explained (12:34)</div>
              <div className="text-xs text-muted-foreground">freeCodeCamp • 98% match</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border">
            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">▶</span>
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium">Data Types Deep Dive (8:22)</div>
              <div className="text-xs text-muted-foreground">CS Dojo • 94% match</div>
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
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium text-foreground">Micro-Check @ 5:30</div>
          <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">Passed</span>
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          "What is the output of: x = 5; print(x + 2)?"
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-1 text-xs bg-muted rounded">5</span>
          <span className="px-2 py-1 text-xs bg-success/20 text-success rounded border border-success">7 ✓</span>
          <span className="px-2 py-1 text-xs bg-muted rounded">52</span>
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
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <div className="text-xs font-medium text-foreground mb-3">Class Progress</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Module 1</span>
            <span className="text-xs text-success">92% complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-success w-[92%] rounded-full" />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">Module 2</span>
            <span className="text-xs text-coral-500">45% complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-coral-500 w-[45%] rounded-full" />
          </div>
        </div>
      </div>
    ),
  },
];

export function HowItWorksSection() {
  const [audience, setAudience] = useState<Audience>("students");
  const steps = audience === "students" ? studentSteps : instructorSteps;

  return (
    <section id="how-it-works" className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coral-500/10 text-coral-500 text-sm font-medium mb-4">
            How It Works
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            From Confusion to{" "}
            <span className="text-gradient bg-gradient-to-r from-coral-400 to-coral-500">Clarity</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            {audience === "students" 
              ? "Four simple steps to understand exactly where you stand and what to do next."
              : "Four simple steps to turn your syllabus into an engaging, trackable video course."
            }
          </p>
        </div>

        {/* Audience toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background border border-border">
            <button
              onClick={() => setAudience("students")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                audience === "students"
                  ? "bg-coral-500 text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GraduationCap className="w-4 h-4" />
              For Students
            </button>
            <button
              onClick={() => setAudience("instructors")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                audience === "instructors"
                  ? "bg-coral-500 text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="w-4 h-4" />
              For Educators
            </button>
          </div>
        </div>

        {/* Steps */}
        <div id="how-it-works-instructor" className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="flex gap-6 items-start"
            >
              {/* Number and line */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral-400 to-coral-500 flex items-center justify-center shadow-lg">
                  <span className="text-lg font-bold text-white">{step.number}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className="w-px h-full bg-gradient-to-b from-coral-500/50 to-transparent mt-4 lg:hidden" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-8">
                <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                  <step.icon className="w-5 h-5 text-coral-500" />
                  {step.title}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {step.description}
                </p>
                {step.visual}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
