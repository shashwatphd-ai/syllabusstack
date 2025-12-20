import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  {
    name: "Students",
    price: "Free",
    tagline: "Everything you need to get honest clarity.",
    features: [
      "Syllabus scanning",
      "Capability extraction",
      "Gap analysis",
      "Actionable recommendations",
    ],
    cta: "Get Started",
    href: "/auth",
    highlight: true,
  },
  {
    name: "Universities",
    price: "Contact",
    tagline: "Cohort insights and curriculum alignment.",
    features: [
      "Program-level reporting",
      "Cohort capability heatmaps",
      "Custom integrations",
      "Priority support",
    ],
    cta: "Talk to us",
    href: "/universities",
    highlight: false,
  },
] as const;

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Simple pricing, built for students
          </h2>
          <p className="text-muted-foreground text-lg">
            Start free, get your honest assessment, and only upgrade if you need institutional features.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlight ? "border-accent/40 shadow-sm" : undefined}
            >
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between gap-4">
                  <span>{plan.name}</span>
                  <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-accent mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild variant={plan.highlight ? "default" : "outline"} className="w-full">
                  <Link to={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
