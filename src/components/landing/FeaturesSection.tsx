import { 
  FileText, Target, Lightbulb, TrendingUp, 
  Video, Users, CheckCircle2, Brain,
  GraduationCap, BookOpen
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Audience = "students" | "instructors";

const studentFeatures = [
  {
    icon: FileText,
    title: "Smart Syllabus Analysis",
    description: "Upload your course syllabi and our AI extracts real capabilities—what you can actually DO, not just what you studied.",
  },
  {
    icon: Target,
    title: "Honest Gap Analysis",
    description: "No sugar-coating. Get a clear assessment of where you stand against job requirements and what's blocking you.",
  },
  {
    icon: Lightbulb,
    title: "Specific Recommendations",
    description: "Not 'learn SQL'. Instead: 'Complete Mode Analytics tutorial (15 hrs) to address your data querying gap.'",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Track your skill-building journey with clear milestones. See exactly how each action moves you toward your goal.",
  },
];

const instructorFeatures = [
  {
    icon: Brain,
    title: "AI Learning Objectives",
    description: "Upload your syllabus and our AI extracts structured learning objectives with Bloom's taxonomy levels.",
  },
  {
    icon: Video,
    title: "Smart Content Curation",
    description: "AI finds and ranks the best YouTube videos for each learning objective. Review and approve, or let it run automatically.",
  },
  {
    icon: CheckCircle2,
    title: "Verified Watching",
    description: "Students can't just skip ahead. Micro-checks during videos ensure actual engagement and comprehension.",
  },
  {
    icon: Users,
    title: "Student Progress Dashboard",
    description: "See which students are struggling, what content works best, and who's ready for assessments.",
  },
];

export function FeaturesSection() {
  const [audience, setAudience] = useState<Audience>("students");
  const features = audience === "students" ? studentFeatures : instructorFeatures;

  return (
    <section id="features" className="py-24 bg-background relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-50">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-coral-500/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-indigo-500/5 to-transparent" />
      </div>

      <div className="container mx-auto px-6 relative">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coral-500/10 text-coral-500 text-sm font-medium mb-4">
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Built for{" "}
            <span className="text-gradient bg-gradient-to-r from-coral-400 to-coral-500">How You Actually Learn</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Whether you're a student navigating your career or an educator building courses, 
            SyllabusStack has the tools you need.
          </p>
        </div>

        {/* Audience toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border">
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

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative bg-card rounded-2xl border border-border p-6 hover:border-coral-500/30 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-coral-400 to-coral-500 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-card-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>

              {/* Hover indicator */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-coral-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-b-2xl" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
