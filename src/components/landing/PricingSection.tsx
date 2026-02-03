import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, GraduationCap, BookOpen, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  {
    name: "Free",
    icon: GraduationCap,
    price: "$0",
    tagline: "Try it out.",
    features: [
      "3 courses",
      "1 dream job",
      "Basic features",
    ],
    cta: "Get Started",
    href: "/auth",
    highlight: false,
  },
  {
    name: "Pro",
    icon: BookOpen,
    price: "$9.99",
    priceDetail: "/mo",
    tagline: "Everything, no limits.",
    features: [
      "Unlimited courses",
      "5 dream jobs",
      "All features included",
    ],
    cta: "Go Pro",
    href: "/checkout?plan=pro",
    highlight: true,
  },
  {
    name: "University",
    icon: Building2,
    price: "Custom",
    tagline: "For teams.",
    features: [
      "Everything unlimited",
      "Multiple instructors",
      "Your branding",
    ],
    cta: "Contact Us",
    href: "/universities",
    highlight: false,
  },
] as const;

export const PricingSection = forwardRef<HTMLElement>(function PricingSection(_props, ref) {
  return (
    <section ref={ref} id="pricing" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coral-500/10 text-coral-500 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Pricing
          </h2>
          <p className="text-muted-foreground text-lg">
            Free to start. Pro when you're ready.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlight ? "border-coral-500/40 shadow-lg shadow-coral-500/10 relative overflow-hidden" : undefined}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-coral-400 to-coral-500" />
              )}
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    plan.highlight 
                      ? "bg-gradient-to-br from-coral-400 to-coral-500" 
                      : "bg-muted"
                  }`}>
                    <plan.icon className={`w-5 h-5 ${plan.highlight ? "text-white" : "text-muted-foreground"}`} />
                  </div>
                  <CardTitle className="flex items-baseline justify-between gap-4 flex-1">
                    <span>{plan.name}</span>
                    <span className="text-2xl font-bold text-foreground">
                      {plan.price}
                      {"priceDetail" in plan && (
                        <span className="text-sm font-normal text-muted-foreground">{plan.priceDetail}</span>
                      )}
                    </span>
                  </CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className={`h-4 w-4 mt-0.5 ${plan.highlight ? "text-coral-500" : "text-muted-foreground"}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  asChild 
                  variant={plan.highlight ? "default" : "outline"} 
                  className={`w-full ${plan.highlight ? "bg-coral-500 hover:bg-coral-600" : ""}`}
                >
                  <Link to={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
});

PricingSection.displayName = "PricingSection";
