import { OnboardingWizard } from "@/components/onboarding";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display text-primary">
            Syllabus<span className="text-accent">Stack</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Let's set up your career profile
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </div>
  );
}
