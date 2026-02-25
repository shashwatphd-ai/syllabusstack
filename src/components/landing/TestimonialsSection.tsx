import { forwardRef } from "react";
import { Shield, Zap, BarChart3, Heart } from "lucide-react";

const trustSignals = [
  {
    icon: Shield,
    title: "Honest by Design",
    description: "No fake metrics. No inflated numbers. We show you exactly where you stand—even when it's uncomfortable.",
  },
  {
    icon: Zap,
    title: "AI-Powered Analysis",
    description: "Your coursework is mapped to real job requirements using AI, not guesswork or self-reported skills.",
  },
  {
    icon: BarChart3,
    title: "Actionable, Not Decorative",
    description: "Every report includes specific next steps with time estimates and costs.",
  },
  {
    icon: Heart,
    title: "Built for Learners",
    description: "Designed around how students actually learn and job-hunt.",
  },
];

export const TestimonialsSection = forwardRef<HTMLElement>(function TestimonialsSection(_props, ref) {
  return (
    <section ref={ref} className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="absolute top-10 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Why SyllabusStack
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Simple, Smart, Honest
          </h2>
          <p className="text-muted-foreground text-lg">
            Here's what makes us different.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {trustSignals.map((signal) => (
            <div
              key={signal.title}
              className="bg-card rounded-2xl border border-border p-6 hover:border-primary/20 hover:shadow-md transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                <signal.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-card-foreground mb-2">{signal.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{signal.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

TestimonialsSection.displayName = "TestimonialsSection";
