import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Shield, Award, GraduationCap, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CertificateSelectionProps {
  enrollmentId: string;
  courseTitle: string;
  completionProgress: number;
  onClose?: () => void;
}

interface CertificateTier {
  type: "completion_badge" | "verified" | "assessed";
  label: string;
  price: number;
  description: string;
  features: string[];
  icon: React.ReactNode;
  recommended?: boolean;
}

const tiers: CertificateTier[] = [
  {
    type: "completion_badge",
    label: "Completion Badge",
    price: 0,
    description: "Basic proof of course completion",
    features: [
      "Digital badge",
      "Shareable link",
      "Course completion verification",
    ],
    icon: <GraduationCap className="h-6 w-6" />,
  },
  {
    type: "verified",
    label: "Verified Certificate",
    price: 25,
    description: "Identity-verified completion",
    features: [
      "Everything in Completion Badge",
      "Government ID verification",
      "PDF certificate with QR code",
      "LinkedIn integration",
      "Employer verification portal",
    ],
    icon: <Shield className="h-6 w-6" />,
    recommended: true,
  },
  {
    type: "assessed",
    label: "Assessed Certificate",
    price: 49,
    description: "Skill mastery with proctored assessment",
    features: [
      "Everything in Verified",
      "Proctored final assessment",
      "Mastery score & skill breakdown",
      "Industry-recognized credential",
      "Priority employer verification",
    ],
    icon: <Award className="h-6 w-6" />,
  },
];

export function CertificateSelection({ 
  enrollmentId, 
  courseTitle, 
  completionProgress,
  onClose 
}: CertificateSelectionProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const isEligible = completionProgress >= 80;

  const handleSelectTier = async (tier: CertificateTier) => {
    if (!isEligible) {
      toast({
        title: "Not eligible yet",
        description: "Complete at least 80% of the course to earn a certificate.",
        variant: "destructive",
      });
      return;
    }

    setLoading(tier.type);

    try {
      if (tier.type === "completion_badge") {
        // Free tier - issue directly
        const { data, error } = await supabase.functions.invoke("issue-certificate", {
          body: { enrollment_id: enrollmentId, certificate_type: "completion_badge" },
        });

        if (error) throw error;

        toast({
          title: "Certificate issued!",
          description: "Your completion badge has been created.",
        });

        if (data?.certificate?.id) {
          navigate(`/certificate/${data.certificate.id}`);
        }
        onClose?.();
      } else {
        // Paid tiers - redirect to Stripe checkout
        const { data, error } = await supabase.functions.invoke("purchase-certificate", {
          body: { enrollment_id: enrollmentId, certificate_type: tier.type },
        });

        if (error) throw error;

        if (data?.checkout_url) {
          window.location.href = data.checkout_url;
        } else {
          throw new Error("Failed to create checkout session");
        }
      }
    } catch (error) {
      console.error("Certificate selection error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process certificate",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Earn Your Certificate</h2>
        <p className="text-muted-foreground mt-1">{courseTitle}</p>
        {!isEligible && (
          <Badge variant="secondary" className="mt-2">
            {Math.round(completionProgress)}% complete - need 80% to earn certificate
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card 
            key={tier.type}
            className={`relative transition-all ${
              tier.recommended 
                ? "border-primary shadow-lg ring-2 ring-primary/20" 
                : "hover:border-muted-foreground/50"
            } ${!isEligible ? "opacity-60" : ""}`}
          >
            {tier.recommended && (
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                Recommended
              </Badge>
            )}
            
            <CardHeader className="text-center pb-2">
              <div className={`mx-auto p-3 rounded-full ${
                tier.recommended ? "bg-primary/10 text-primary" : "bg-muted"
              }`}>
                {tier.icon}
              </div>
              <CardTitle className="text-lg">{tier.label}</CardTitle>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-center">
                <span className="text-3xl font-bold">
                  {tier.price === 0 ? "Free" : `$${tier.price}`}
                </span>
                {tier.price > 0 && (
                  <span className="text-muted-foreground text-sm"> one-time</span>
                )}
              </div>

              <Separator />

              <ul className="space-y-2">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={tier.recommended ? "default" : "outline"}
                disabled={!isEligible || loading !== null}
                onClick={() => handleSelectTier(tier)}
              >
                {loading === tier.type ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : tier.price === 0 ? (
                  "Claim Badge"
                ) : (
                  <>
                    Purchase
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        All certificates include a unique verification code and shareable link. 
        Verified and Assessed certificates provide enhanced trust for employers.
      </p>
    </div>
  );
}
