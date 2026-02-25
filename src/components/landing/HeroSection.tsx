import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, GraduationCap, BookOpen, Users, Video, CheckCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Audience = "students" | "instructors";

interface HeroSectionProps {
  audience: Audience;
  onAudienceChange: (audience: Audience) => void;
}

export const HeroSection = forwardRef<HTMLElement, HeroSectionProps>(function HeroSection({ audience, onAudienceChange }, ref) {
  return (
    <section ref={ref} className="relative py-24 lg:py-32 bg-hero overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-700/30 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative container mx-auto px-6 pt-16 pb-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Audience toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 mb-8 animate-fade-up">
            <button
              onClick={() => onAudienceChange("students")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                audience === "students"
                  ? "bg-amber-500 text-amber-950 shadow-lg"
                  : "text-primary-foreground/70 hover:text-primary-foreground"
              )}
            >
              <GraduationCap className="w-4 h-4" />
              I'm a Student
            </button>
            <button
              onClick={() => onAudienceChange("instructors")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                audience === "instructors"
                  ? "bg-amber-500 text-amber-950 shadow-lg"
                  : "text-primary-foreground/70 hover:text-primary-foreground"
              )}
            >
              <BookOpen className="w-4 h-4" />
              I'm an Educator
            </button>
          </div>

          {/* Dynamic content based on audience */}
          {audience === "students" ? (
            <StudentHero />
          ) : (
            <InstructorHero />
          )}
        </div>

        {/* Floating feature cards */}
        {audience === "students" ? (
          <>
            <div className="absolute left-8 top-1/2 hidden xl:block animate-float" style={{ animationDelay: '0s' }}>
              <div className="bg-primary-foreground/5 backdrop-blur-xl border border-primary-foreground/10 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-primary-foreground">Gap Analysis</div>
                    <div className="text-xs text-primary-foreground/50">See what's missing</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute right-8 top-1/3 hidden xl:block animate-float" style={{ animationDelay: '2s' }}>
              <div className="bg-primary-foreground/5 backdrop-blur-xl border border-primary-foreground/10 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-primary-foreground">Action Plan</div>
                    <div className="text-xs text-primary-foreground/50">Know what to do next</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="absolute left-8 top-1/2 hidden xl:block animate-float" style={{ animationDelay: '0s' }}>
              <div className="bg-primary-foreground/5 backdrop-blur-xl border border-primary-foreground/10 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Video className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-primary-foreground">Videos Matched</div>
                    <div className="text-xs text-primary-foreground/50">Quality content for each topic</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute right-8 top-1/3 hidden xl:block animate-float" style={{ animationDelay: '2s' }}>
              <div className="bg-primary-foreground/5 backdrop-blur-xl border border-primary-foreground/10 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-primary-foreground">Learning Outcomes</div>
                    <div className="text-xs text-primary-foreground/50">Measure what matters</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
});

HeroSection.displayName = "HeroSection";

function StudentHero() {
  return (
    <>
      <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
        See How Your Coursework{" "}
        <span className="relative">
          <span className="text-gradient bg-gradient-to-r from-amber-300 to-amber-500">Maps</span>
          <svg className="absolute -bottom-2 left-0 w-full h-3 text-amber-500/30" viewBox="0 0 200 12" preserveAspectRatio="none">
            <path d="M0,8 Q50,0 100,8 T200,8" fill="none" stroke="currentColor" strokeWidth="4"/>
          </svg>
        </span>{" "}
        to Jobs
      </h1>

      <p className="text-lg sm:text-xl text-primary-foreground/70 max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        Upload your coursework, add your dream jobs, and get 
        <span className="text-amber-300 font-semibold"> AI-powered skill mapping</span> showing exactly 
        where you stand—and what to do next.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up" style={{ animationDelay: '0.3s' }}>
        <Button asChild variant="hero" size="xl" className="group">
          <Link to="/auth?role=student">
            Start Your Analysis
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
        <Button asChild variant="heroOutline" size="xl">
          <a href="#how-it-works">See How It Works</a>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 text-primary-foreground/50 text-sm animate-fade-up" style={{ animationDelay: '0.4s' }}>
        <span className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-amber-400" />
          Free to start
        </span>
        <span className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-amber-400" />
          Pay per action or subscribe
        </span>
        <span className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-amber-400" />
          No resume needed
        </span>
      </div>
    </>
  );
}

function InstructorHero() {
  return (
    <>
      <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-primary-foreground leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
        Turn Your Syllabus Into a{" "}
        <span className="relative">
          <span className="text-gradient bg-gradient-to-r from-amber-300 to-amber-500">Video Course</span>
          <svg className="absolute -bottom-2 left-0 w-full h-3 text-amber-500/30" viewBox="0 0 200 12" preserveAspectRatio="none">
            <path d="M0,8 Q50,0 100,8 T200,8" fill="none" stroke="currentColor" strokeWidth="4"/>
          </svg>
        </span>
      </h1>

      <p className="text-lg sm:text-xl text-primary-foreground/70 max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        Upload your syllabus. We match each topic with
        <span className="text-amber-300 font-semibold"> quality video content</span>.
        Your students get structured, engaging content that builds real skills.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up" style={{ animationDelay: '0.3s' }}>
        <Button asChild variant="hero" size="xl" className="group">
          <Link to="/auth?role=instructor">
            Create Your Course
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
        <Button asChild variant="heroOutline" size="xl">
          <a href="#how-it-works">See How It Works</a>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 text-primary-foreground/50 text-sm animate-fade-up" style={{ animationDelay: '0.4s' }}>
        <span className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-amber-400" />
          $1 per course, or unlimited with Pro
        </span>
        <span className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-amber-400" />
          Ready in minutes
        </span>
        <span className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-amber-400" />
          Built-in comprehension checks
        </span>
      </div>
    </>
  );
}
