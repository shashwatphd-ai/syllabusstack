import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Target, BookOpen } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-screen bg-hero overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-navy-700/30 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative container mx-auto px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-sm font-medium mb-8 animate-fade-up">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Career Intelligence</span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Know Your{" "}
            <span className="relative">
              <span className="text-gradient bg-gradient-to-r from-teal-300 to-teal-500">Real</span>
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-teal-500/30" viewBox="0 0 200 12" preserveAspectRatio="none">
                <path d="M0,8 Q50,0 100,8 T200,8" fill="none" stroke="currentColor" strokeWidth="4"/>
              </svg>
            </span>{" "}
            Job Readiness
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-primary-foreground/70 max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Stop guessing. Upload your coursework, add your dream jobs, and get 
            <span className="text-teal-300 font-semibold"> honest AI analysis</span> of exactly 
            where you stand—and what to do next.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Button variant="hero" size="xl" className="group">
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="heroOutline" size="xl">
              See How It Works
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-1">94%</div>
              <div className="text-sm text-primary-foreground/50">Accuracy Rate</div>
            </div>
            <div className="text-center border-x border-primary-foreground/10">
              <div className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-1">10K+</div>
              <div className="text-sm text-primary-foreground/50">Students Helped</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-1">500+</div>
              <div className="text-sm text-primary-foreground/50">Universities</div>
            </div>
          </div>
        </div>

        {/* Feature cards floating */}
        <div className="absolute left-8 top-1/2 hidden xl:block animate-float" style={{ animationDelay: '0s' }}>
          <div className="bg-primary-foreground/5 backdrop-blur-xl border border-primary-foreground/10 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-primary-foreground">Gap Analysis</div>
                <div className="text-xs text-primary-foreground/50">Find your gaps</div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute right-8 top-1/3 hidden xl:block animate-float" style={{ animationDelay: '2s' }}>
          <div className="bg-primary-foreground/5 backdrop-blur-xl border border-primary-foreground/10 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-primary-foreground">Smart Recs</div>
                <div className="text-xs text-primary-foreground/50">Actionable steps</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
