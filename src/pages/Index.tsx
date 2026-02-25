import { useState } from "react";
import { Header } from "@/components/landing/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

type Audience = "students" | "instructors";

const Index = () => {
  const [audience, setAudience] = useState<Audience>("students");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection audience={audience} onAudienceChange={setAudience} />
        <FeaturesSection audience={audience} />
        <HowItWorksSection audience={audience} />
        <TestimonialsSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
