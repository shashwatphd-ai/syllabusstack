import { FileText, Target, Lightbulb, TrendingUp, Brain, Shield } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Smart Syllabus Analysis",
    description: "Upload your course syllabi and our AI extracts real capabilities—what you can actually DO, not just what you studied.",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: Target,
    title: "Honest Gap Analysis",
    description: "No sugar-coating. Get a clear assessment of where you stand against job requirements and what's blocking you.",
    color: "from-teal-500 to-teal-600",
  },
  {
    icon: Lightbulb,
    title: "Specific Recommendations",
    description: "Not 'learn SQL'. Instead: 'Complete Mode Analytics tutorial (15 hrs) to address your data querying gap.'",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Track your skill-building journey with clear milestones. See exactly how each action moves you toward your goal.",
    color: "from-emerald-500 to-green-600",
  },
  {
    icon: Brain,
    title: "AI That Understands Context",
    description: "Our AI uses advanced language models optimized for each task—extraction, analysis, and recommendations. No generic advice.",
    color: "from-purple-500 to-violet-600",
  },
  {
    icon: Shield,
    title: "University-Grade Security",
    description: "Your academic data stays private. Row-level security ensures only you see your analysis.",
    color: "from-rose-500 to-pink-600",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-background relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-50">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-teal-50 to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-blue-50 to-transparent" />
      </div>

      <div className="container mx-auto px-6 relative">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Career Intelligence,{" "}
            <span className="text-gradient bg-gradient-to-r from-primary to-accent">Not Guesswork</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Traditional career tools use keyword matching. We use AI that actually understands context, nuance, and real job requirements.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative bg-card rounded-2xl border border-border p-6 hover:border-accent/30 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-card-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>

              {/* Hover indicator */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-b-2xl" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
