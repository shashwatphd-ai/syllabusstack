import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, CheckCircle } from "lucide-react";

export const CTASection = forwardRef<HTMLElement>(function CTASection(_props, ref) {
  return (
    <section ref={ref} className="py-24 bg-hero relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-coral-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-coral-500/10 border border-coral-500/20 text-coral-300 text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            <span>Try Free Today</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            Stop Guessing.
            <br />
            <span className="text-gradient bg-gradient-to-r from-coral-300 to-coral-500">Start Knowing.</span>
          </h2>

          <p className="text-lg text-primary-foreground/70 mb-10 max-w-xl mx-auto">
            Whether you're a student finding your career path or an educator building 
            engaging courses—SyllabusStack has you covered.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild variant="hero" size="xl" className="group">
              <Link to="/auth">
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          {/* Trust indicators - honest about pricing */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-primary-foreground/50 text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-coral-400" />
              Free to get started
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-coral-400" />
              Pro removes all limits
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-coral-400" />
              No credit card required
            </span>
          </div>
        </div>
      </div>
    </section>
  );
});

CTASection.displayName = "CTASection";
