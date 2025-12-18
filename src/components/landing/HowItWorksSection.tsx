import { Upload, Search, CheckCircle, Rocket } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your Courses",
    description: "Add your course syllabi—PDF, DOCX, or paste text. Our AI extracts what you actually learned.",
    visual: (
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Upload className="w-4 h-4 text-primary" />
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
          <span className="px-2 py-1 text-xs bg-accent/10 text-accent rounded-md">SQL queries</span>
          <span className="px-2 py-1 text-xs bg-accent/10 text-accent rounded-md">PRD writing</span>
          <span className="px-2 py-1 text-xs bg-accent/10 text-accent rounded-md">A/B testing</span>
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
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-accent">1</span>
            </div>
            <div>
              <div className="text-xs font-medium text-foreground">Mode Analytics SQL Course</div>
              <div className="text-xs text-muted-foreground">15 hrs • Free • Closes data gap</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-accent">2</span>
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

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            How It Works
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            From Confusion to{" "}
            <span className="text-gradient bg-gradient-to-r from-primary to-accent">Clarity</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Four simple steps to understand exactly where you stand and what to do next.
          </p>
        </div>

        {/* Steps */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="flex gap-6 items-start"
            >
              {/* Number and line */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <span className="text-lg font-bold text-primary-foreground">{step.number}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className="w-px h-full bg-gradient-to-b from-accent/50 to-transparent mt-4 lg:hidden" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-8">
                <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                  <step.icon className="w-5 h-5 text-accent" />
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
