import { forwardRef } from "react";
import { 
  FileText, Target, Lightbulb, TrendingUp, 
  Video, Users, CheckCircle2, Brain
} from "lucide-react";

type Audience = "students" | "instructors";

interface FeaturesSectionProps {
  audience: Audience;
}

const studentFeatures = [
  {
    icon: FileText,
    title: "Upload Your Courses",
    description: "Add your syllabi and see what skills you've actually built—not just course names, but what you can do.",
  },
  {
    icon: Target,
    title: "See Where You Stand",
    description: "Compare your skills to real job requirements. Find out what's missing before you apply.",
  },
  {
    icon: Lightbulb,
    title: "Know What to Do Next",
    description: "Get specific steps: which courses, tutorials, or projects will close your gaps fastest.",
  },
  {
    icon: TrendingUp,
    title: "Track Your Progress",
    description: "See how each action moves you closer to your goal. Know when you're ready.",
  },
];

const instructorFeatures = [
  {
    icon: Brain,
    title: "Upload Your Syllabus",
    description: "Paste or upload your syllabus. We turn it into clear learning goals your students can follow.",
  },
  {
    icon: Video,
    title: "Videos Matched to Your Course",
    description: "Each topic gets matched with quality YouTube content. Review it or let it run automatically.",
  },
  {
    icon: CheckCircle2,
    title: "Built-In Comprehension Checks",
    description: "Short questions during videos reinforce key concepts and confirm understanding.",
  },
  {
    icon: Users,
    title: "Measure Learning Outcomes",
    description: "See which topics are clicking and where your course can improve.",
  },
];

export const FeaturesSection = forwardRef<HTMLElement, FeaturesSectionProps>(function FeaturesSection({ audience }, ref) {
  const features = audience === "students" ? studentFeatures : instructorFeatures;

  return (
    <section ref={ref} id="features" className="py-24 bg-background relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-50">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-amber-500/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-indigo-500/5 to-transparent" />
      </div>

      <div className="container mx-auto px-6 relative">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-sm font-medium mb-4">
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            What You{" "}
            <span className="text-gradient bg-gradient-to-r from-amber-400 to-amber-500">Get</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Everything you need, nothing you don't.
          </p>
        </div>

        {/* Features grid — no toggle, controlled by parent */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative bg-card rounded-2xl border border-border p-6 hover:border-amber-500/30 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-white" />
              </div>

              <h3 className="text-lg font-semibold text-card-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>

              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-b-2xl" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

FeaturesSection.displayName = "FeaturesSection";
