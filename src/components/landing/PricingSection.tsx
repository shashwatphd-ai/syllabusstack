import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, GraduationCap, BookOpen, Building2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    icon: GraduationCap,
    price: "$0",
    priceNote: "*",
    tagline: "Pay as you go.",
    features: [
      "Up to 3 courses",
      "1 dream job analysis",
      "20 AI calls/month",
      "$1 per course/enrollment",
    ],
    cta: "Get Started",
    href: "/auth",
    highlight: false,
    tier: "starter",
  },
  {
    name: "Pro",
    icon: BookOpen,
    price: "$9.99",
    priceDetail: "/mo",
    tagline: "No per-action fees.",
    features: [
      "No per-action fees",
      "Unlimited courses",
      "Up to 5 dream jobs",
      "200 AI calls/month",
      "PDF export",
    ],
    cta: "Go Pro",
    href: "/checkout?plan=pro",
    highlight: true,
    tier: "popular",
  },
  {
    name: "University",
    icon: Building2,
    price: "Custom",
    tagline: "For institutions.",
    features: [
      "Everything unlimited",
      "Multiple instructors",
      "Custom branding",
      "Admin dashboard",
    ],
    cta: "Contact Us",
    href: "/universities",
    highlight: false,
    tier: "enterprise",
  },
] as const;

export const PricingSection = forwardRef<HTMLElement>(function PricingSection(_props, ref) {
  return (
    <section ref={ref} id="pricing" className="py-24 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl opacity-50" />
      
      <div className="container mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Pricing
          </h2>
          <p className="text-muted-foreground text-lg">
            Free to start. Pro when you're ready.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto items-start">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={cn(
                "relative group",
                plan.highlight && "md:-mt-4 md:mb-4"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Popular badge */}
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-amber-950 text-xs font-semibold shadow-lg shadow-amber-500/25">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    Most Popular
                  </div>
                </div>
              )}

              {/* Card */}
              <div
                className={cn(
                  "relative rounded-2xl p-6 transition-all duration-300",
                  "border backdrop-blur-sm",
                  plan.highlight
                    ? "bg-gradient-to-b from-primary/10 via-background to-background border-primary/30 shadow-2xl shadow-primary/10"
                    : "bg-card/80 border-border hover:border-primary/20 hover:shadow-lg",
                  "group-hover:translate-y-[-2px]"
                )}
              >
                {/* Highlight glow effect */}
                {plan.highlight && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                )}

                {/* Pay-per-action badge for Free tier */}
                {plan.name === "Free" && (
                  <div className="absolute top-4 right-4">
                    <span className="text-xs text-muted-foreground bg-muted/80 px-2.5 py-1 rounded-full border border-border">
                      Pay-per-action
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="relative mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                        plan.highlight
                          ? "bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25"
                          : plan.tier === "enterprise"
                          ? "bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/20"
                          : "bg-muted border border-border"
                      )}
                    >
                      <plan.icon
                        className={cn(
                          "w-6 h-6",
                          plan.highlight
                            ? "text-primary-foreground"
                            : plan.tier === "enterprise"
                            ? "text-purple-600"
                            : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mt-4">
                    <span
                      className={cn(
                        "text-4xl font-bold",
                        plan.highlight ? "text-primary" : "text-foreground"
                      )}
                    >
                      {plan.price}
                    </span>
                    {"priceNote" in plan && (
                      <sup className="text-sm text-muted-foreground">{plan.priceNote}</sup>
                    )}
                    {"priceDetail" in plan && (
                      <span className="text-base font-normal text-muted-foreground">
                        {plan.priceDetail}
                      </span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div
                  className={cn(
                    "h-px mb-6",
                    plan.highlight
                      ? "bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                      : "bg-border"
                  )}
                />

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <div
                        className={cn(
                          "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5",
                          plan.highlight
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  asChild
                  className={cn(
                    "w-full h-12 font-semibold transition-all",
                    plan.highlight
                      ? "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-amber-950 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
                      : "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                  )}
                  variant={plan.highlight ? "default" : "ghost"}
                >
                  <Link to={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing footnote */}
        <p className="text-center text-sm text-muted-foreground mt-12">
          * Free tier includes $1 fee per course creation or enrollment.{" "}
          <Link to="/billing#pricing" className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors">
            See full pricing details
          </Link>
        </p>
      </div>
    </section>
  );
});

PricingSection.displayName = "PricingSection";
