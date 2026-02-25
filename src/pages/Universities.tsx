import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { ArrowRight, BookOpen, BarChart3, Users, GraduationCap, Settings, Palette } from "lucide-react";

const valueProps = [
  {
    icon: BookOpen,
    title: "Curriculum → Capability",
    description: "Convert syllabi into concrete, comparable capabilities across courses and programs.",
  },
  {
    icon: BarChart3,
    title: "Career Alignment",
    description: "Benchmark programs against target roles and highlight where learners are likely to fall short.",
  },
  {
    icon: Users,
    title: "Cohort Analytics",
    description: "Understand learning outcomes at scale—across sections, semesters, and programs.",
  },
  {
    icon: GraduationCap,
    title: "Instructor Tools",
    description: "Give faculty AI-powered course building with video matching and comprehension checks.",
  },
  {
    icon: Palette,
    title: "Custom Branding",
    description: "White-label the student experience with your institution's identity and branding.",
  },
  {
    icon: Settings,
    title: "Admin Dashboard",
    description: "Manage instructors, courses, and enrollment from a centralized admin panel.",
  },
];

export default function UniversitiesPage() {
  useSEO({
    title: "For Universities",
    description: "SyllabusStack for universities: curriculum-to-career alignment, cohort insights, and instructor tools.",
    canonical: "/universities",
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            SyllabusStack for Universities
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Understand what students actually learn—and how it maps to real job requirements.
            Curriculum intelligence for the entire institution.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" asChild>
              <a href="mailto:partnerships@syllabusstack.com">
                Schedule a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/#pricing">See Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What You Get</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Tools built for institutional scale—from individual courses to entire programs.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {valueProps.map((prop) => (
              <Card key={prop.title} className="hover:border-primary/20 hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                    <prop.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{prop.title}</h3>
                  <p className="text-sm text-muted-foreground">{prop.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-8">
            We work with universities to customize SyllabusStack for your programs.
            Let's talk about what your institution needs.
          </p>
          <Button size="lg" asChild>
            <a href="mailto:partnerships@syllabusstack.com">
              Contact Partnerships
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
