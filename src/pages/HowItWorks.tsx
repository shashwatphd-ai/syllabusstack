import { 
  Play, Shield, Clock, CheckCircle, AlertTriangle, 
  Upload, Search, BookOpen, Brain, Award, Users,
  Monitor, FastForward, Eye, Rewind, GraduationCap,
  ArrowRight, Zap, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

// Student journey steps
const studentSteps = [
  {
    step: 1,
    title: "Join a Course",
    description: "Enter the access code your instructor provides to enroll in a verified course.",
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
    description: "Quick questions pop up during videos to ensure you're actively learning.",
    icon: Brain,
    detail: "Get it wrong? The video rewinds so you can actually learn the concept, not just skip ahead."
  },
  {
    step: 5,
    title: "Complete with 70%+ Engagement",
    description: "Your engagement score combines watch time, micro-check accuracy, and focus.",
    icon: CheckCircle,
    detail: "This unlocks the assessment—proof that you engaged with the material, not just played it."
  },
  {
    step: 6,
    title: "Take Assessment",
    description: "Demonstrate actual understanding with AI-generated questions on the learning objective.",
    icon: Award,
    detail: "Pass the assessment and earn verified proof of learning for your portfolio."
  }
];

// Anti-gaming measures
const antiGamingMeasures = [
  {
    icon: FastForward,
    title: "Speed Detection",
    description: "Playback above 2x is blocked. No speed-running through content.",
    color: "text-destructive"
  },
  {
    icon: Monitor,
    title: "Segment Tracking",
    description: "Only unique watched seconds count. Replaying the same 10 seconds 100 times doesn't work.",
    color: "text-warning"
  },
  {
    icon: Eye,
    title: "Tab Focus Monitoring",
    description: "We detect when you switch tabs. Background playing is tracked and penalized.",
    color: "text-warning"
  },
  {
    icon: Rewind,
    title: "Micro-Check Enforcement",
    description: "Fail a question? Video rewinds 30 seconds. Timeout? Same thing. No skipping ahead.",
    color: "text-destructive"
  }
];

// Instructor benefits
const instructorBenefits = [
  {
    title: "Zero Content Creation",
    description: "AI finds relevant YouTube content for each learning objective. You just review and approve.",
    icon: Zap
  },
  {
    title: "Full Verification",
    description: "Know that students actually watched and understood—not just claimed they did.",
    icon: Shield
  },
  {
    title: "Easy Setup",
    description: "Upload syllabus → AI extracts objectives → Review matches → Publish with access code.",
    icon: Upload
  }
];

// Value propositions
const valueProps = [
  {
    audience: "Students",
    benefits: [
      "Curated content—no more searching for 'the good video'",
      "Accountability that actually helps you learn",
      "Verified credentials you can show to employers",
      "Remediation path when you don't understand"
    ],
    icon: GraduationCap,
    cta: "Get Started Free",
    href: "/auth"
  },
  {
    audience: "Instructors",
    benefits: [
      "Zero content creation burden",
      "Know students actually engaged",
      "AI-powered question generation",
      "Simple course management"
    ],
    icon: Users,
    cta: "Learn More",
    href: "/universities"
  },
  {
    audience: "Employers",
    benefits: [
      "Trustworthy learning credentials",
      "Verified, not just claimed skills",
      "Anti-cheating measures built in",
      "Objective engagement scores"
    ],
    icon: Award,
    cta: "Partner With Us",
    href: "/universities"
  }
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-navy-900 to-background">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-6 text-teal-400 border-teal-400/30 bg-teal-400/10">
              Verified Learning System
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
              Prove You <span className="text-teal-400">Learned</span> It,<br />
              Don't Just Claim You <span className="text-teal-400">Watched</span> It
            </h1>
            <p className="text-xl text-primary-foreground/70 mb-8 max-w-2xl mx-auto">
              EduThree transforms passive video consumption into verified, accountable learning 
              with engagement tracking and anti-gaming measures.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild variant="hero" size="lg">
                <Link to="/auth">Get Started Free</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/5">
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
              Traditional video-based learning has no accountability. Students game the system, 
              and instructors have no way to verify engagement.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Play, text: "Background playing", desc: "Open in another tab, do something else" },
              { icon: FastForward, text: "Speed watching", desc: "4x speed to 'finish' faster" },
              { icon: Monitor, text: "Tab switching", desc: "Video plays while browsing Reddit" },
              { icon: Clock, text: "Skipping ahead", desc: "Jump to the end, mark as complete" }
            ].map((problem, i) => (
              <Card key={i} className="bg-destructive/5 border-destructive/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                    <problem.icon className="w-6 h-6 text-destructive" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{problem.text}</h3>
                  <p className="text-sm text-muted-foreground">{problem.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Result: Certificates without learning</span>
            </div>
          </div>
        </div>
      </section>

      {/* Student Journey Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Student Journey</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              How Verified Learning Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Six steps from enrollment to verified credential—with accountability at every stage.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {studentSteps.map((step, index) => (
              <div key={step.step} className="flex gap-6 mb-8 last:mb-0">
                {/* Step indicator */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg">
                    {step.step}
                  </div>
                  {index < studentSteps.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-accent to-border mt-4" />
                  )}
                </div>

                {/* Content */}
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

      {/* Anti-Gaming Measures Section */}
      <section className="py-20 bg-navy-900">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4 text-teal-400 border-teal-400/30 bg-teal-400/10">
              Anti-Gaming Measures
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
              We Know the <span className="text-teal-400">Tricks</span>
            </h2>
            <p className="text-lg text-primary-foreground/70">
              Every common cheating method is detected and prevented. 
              You can't game the system—so you might as well actually learn.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {antiGamingMeasures.map((measure, i) => (
              <Card key={i} className="bg-primary-foreground/5 border-primary-foreground/10">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center flex-shrink-0`}>
                      <measure.icon className={`w-5 h-5 ${measure.color}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-primary-foreground mb-2">{measure.title}</h3>
                      <p className="text-primary-foreground/70">{measure.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-400/10 text-teal-400">
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

          {/* Instructor flow diagram */}
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
              Students get proof of learning. Instructors get verified engagement. 
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
      <section className="py-20 bg-gradient-to-b from-background to-navy-900">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ready for <span className="text-teal-400">Verified</span> Learning?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of students who are proving their learning, not just claiming it.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild variant="hero" size="lg">
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
