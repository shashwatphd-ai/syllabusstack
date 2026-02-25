import { 
  Play, Shield, Clock, CheckCircle, 
  Upload, Search, BookOpen, Brain, Award, Users,
  FastForward, GraduationCap,
  ArrowRight, Zap, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

const studentSteps = [
  {
    step: 1,
    title: "Join a Course",
    description: "Enter the access code your instructor provides to enroll in a course.",
    icon: BookOpen,
    detail: "Access codes ensure only authorized students can join. Your progress is tracked from day one."
  },
  {
    step: 2,
    title: "Browse Learning Objectives",
    description: "See exactly what you need to learn, organized by module and topic.",
    icon: Search,
    detail: "Each learning objective maps to specific skills you'll demonstrate mastery of."
  },
  {
    step: 3,
    title: "Watch Curated Content",
    description: "YouTube videos hand-picked by AI and approved by your instructor for each objective.",
    icon: Play,
    detail: "No searching for content—we've already found the best explanations for every concept."
  },
  {
    step: 4,
    title: "Answer Micro-Checks",
    description: "Quick questions pop up during videos to reinforce what you're learning.",
    icon: Brain,
    detail: "Get it wrong? The video rewinds so you can revisit the concept and try again."
  },
  {
    step: 5,
    title: "Reach 70%+ Engagement",
    description: "Your engagement score combines watch time, micro-check accuracy, and focus.",
    icon: CheckCircle,
    detail: "This unlocks the assessment—confirming you engaged with the material before testing."
  },
  {
    step: 6,
    title: "Take Assessment",
    description: "Demonstrate actual understanding with AI-generated questions on the learning objective.",
    icon: Award,
    detail: "Pass the assessment and earn verified proof of learning for your portfolio."
  }
];

const engagementFeatures = [
  {
    icon: FastForward,
    title: "Paced Viewing",
    description: "Content plays at a pace designed for learning, not speed-running.",
  },
  {
    icon: Clock,
    title: "Progress Tracking",
    description: "Only unique watched content counts toward your engagement score.",
  },
  {
    icon: Brain,
    title: "Comprehension Checks",
    description: "Short questions during videos reinforce key concepts as you learn.",
  },
  {
    icon: Shield,
    title: "Engagement Threshold",
    description: "70% engagement required to unlock assessments—ensuring you're prepared.",
  },
];

const instructorBenefits = [
  {
    title: "Zero Content Creation",
    description: "AI finds relevant YouTube content for each learning objective. You just review and approve.",
    icon: Zap
  },
  {
    title: "Built-In Comprehension",
    description: "Comprehension checks are generated automatically to reinforce learning during videos.",
    icon: Shield
  },
  {
    title: "Easy Setup",
    description: "Upload syllabus → AI extracts objectives → Review matches → Publish with access code.",
    icon: Upload
  }
];

const valueProps = [
  {
    audience: "Students",
    benefits: [
      "Curated content—no more searching for 'the good video'",
      "Active learning that reinforces understanding",
      "Verified credentials you can show to employers",
      "Clear path when you don't understand something"
    ],
    icon: GraduationCap,
    cta: "Get Started Free",
    href: "/auth?role=student"
  },
  {
    audience: "Instructors",
    benefits: [
      "Zero content creation burden",
      "Built-in comprehension checks",
      "AI-powered question generation",
      "Simple course management"
    ],
    icon: Users,
    cta: "Create a Course",
    href: "/auth?role=instructor"
  },
  {
    audience: "Employers",
    benefits: [
      "Trustworthy learning credentials",
      "Verified skill demonstrations",
      "Engagement-backed certificates",
      "Objective mastery scores"
    ],
    icon: Award,
    cta: "Learn More",
    href: "/employers"
  }
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-6 text-amber-500 border-amber-500/30 bg-amber-500/10">
              How It Works
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Learn Actively,{" "}
              <span className="text-primary">Prove It</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              SyllabusStack turns passive video watching into active, verified learning 
              with built-in engagement features and comprehension checks.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild variant="default" size="lg">
                <Link to="/auth">Get Started Free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/universities">For Universities</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              The Problem with Video Learning
            </h2>
            <p className="text-lg text-muted-foreground">
              Traditional video-based learning lacks accountability. Without active engagement,
              students miss key concepts and certificates lose their meaning.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Play, text: "Passive watching", desc: "Playing videos without engaging with the content" },
              { icon: FastForward, text: "Speed watching", desc: "Rushing through to finish faster" },
              { icon: Clock, text: "No retention", desc: "Watching without understanding or remembering" },
              { icon: CheckCircle, text: "Empty completions", desc: "Marking things done without learning" }
            ].map((problem, i) => (
              <Card key={i} className="border border-border">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <problem.icon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{problem.text}</h3>
                  <p className="text-sm text-muted-foreground">{problem.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Student Journey Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Student Journey</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Six Steps to Verified Learning
            </h2>
            <p className="text-lg text-muted-foreground">
              From enrollment to verified credential—with active learning at every stage.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {studentSteps.map((step, index) => (
              <div key={step.step} className="flex gap-6 mb-8 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg">
                    {step.step}
                  </div>
                  {index < studentSteps.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-accent to-border mt-4" />
                  )}
                </div>

                <Card className="flex-1 mb-4">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <step.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                        <p className="text-muted-foreground mb-3">{step.description}</p>
                        <p className="text-sm text-muted-foreground/80 italic">{step.detail}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Engagement Features Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/10">
              Built for Real Engagement
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Learning That <span className="text-primary">Sticks</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Features designed to keep you engaged and help you actually retain what you learn.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {engagementFeatures.map((feature, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
              <Lock className="w-4 h-4" />
              <span className="text-sm font-medium">70% engagement required to unlock assessment</span>
            </div>
          </div>
        </div>
      </section>

      {/* For Instructors Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">For Instructors</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Curate, Don't Create
            </h2>
            <p className="text-lg text-muted-foreground">
              Let AI find the content. You just approve what's good enough for your students.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {instructorBenefits.map((benefit, i) => (
              <Card key={i}>
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <benefit.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-16 max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-center items-center gap-4 text-center">
              {[
                "Upload Syllabus",
                "AI Extracts LOs",
                "AI Finds Videos",
                "You Approve",
                "AI Generates Questions",
                "Students Learn"
              ].map((step, i, arr) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium">
                    {step}
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everyone Wins
            </h2>
            <p className="text-lg text-muted-foreground">
              Students get proof of learning. Instructors get engagement insights. 
              Employers get trustworthy credentials.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {valueProps.map((prop, i) => (
              <Card key={i} className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <prop.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{prop.audience}</h3>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {prop.benefits.map((benefit, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground text-sm">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" className="w-full">
                    <Link to={prop.href}>{prop.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ready for <span className="text-primary">Active</span> Learning?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Start learning with built-in engagement tools, or create your first course in minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/auth">Get Started Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/universities">For Universities</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
