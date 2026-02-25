import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const CTASection = forwardRef<HTMLElement>(function CTASection(_props, ref) {
  return (
    <section ref={ref} className="py-24 bg-hero relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            <span>Try Free Today</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            See where you{" "}
            <span className="text-gradient bg-gradient-to-r from-amber-300 to-amber-500">stand.</span>
          </h2>

          <p className="text-lg text-primary-foreground/70 mb-10 max-w-xl mx-auto">
            Free to start. No credit card required.
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

          {/* Trust indicators */}
          
        </div>
      </div>
    </section>
  );
});

CTASection.displayName = "CTASection";
