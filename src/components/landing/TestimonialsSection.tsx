import { forwardRef } from "react";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote: "I thought I was ready for PM roles. SyllabusStack showed me I was missing critical SQL skills. Saved me months of failed applications.",
    name: "Sarah Chen",
    title: "Business Major → PM at Stripe",
    university: "UC Berkeley",
    avatar: "SC",
  },
  {
    quote: "The specificity is unreal. Not 'learn finance'—actual courses, time estimates, and exactly why each action mattered.",
    name: "Marcus Rodriguez",
    title: "Econ Major → IB Analyst",
    university: "NYU Stern",
    avatar: "MR",
  },
  {
    quote: "Finally, a tool that tells you the truth. My career center said I was 'on track'. SyllabusStack showed me 3 critical gaps.",
    name: "Priya Patel",
    title: "CS Major → Product Manager",
    university: "Georgia Tech",
    avatar: "PP",
  },
];

export const TestimonialsSection = forwardRef<HTMLElement>(function TestimonialsSection(_props, ref) {
  return (
    <section ref={ref} className="py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium mb-4">
            Success Stories
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Students Who Got{" "}
            <span className="text-gradient bg-gradient-to-r from-success to-teal-500">Real Results</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Join thousands of students who stopped guessing and started acting with confidence.
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-all duration-300 relative"
            >
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-accent/20 absolute top-6 right-6" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-foreground mb-6 leading-relaxed text-sm">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-semibold text-primary-foreground">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{testimonial.name}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.title}</div>
                  <div className="text-xs text-accent">{testimonial.university}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof bar */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground text-sm mb-4">Trusted by students from</p>
          <div className="flex flex-wrap justify-center gap-8 items-center opacity-60">
            {['Stanford', 'MIT', 'Harvard', 'Berkeley', 'NYU', 'Michigan'].map((uni) => (
              <span key={uni} className="text-lg font-semibold text-muted-foreground">
                {uni}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

TestimonialsSection.displayName = "TestimonialsSection";
