import { SignupForm } from "@/components/auth";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display text-primary">
            Edu<span className="text-accent">Three</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Create your account and start mapping your career
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
