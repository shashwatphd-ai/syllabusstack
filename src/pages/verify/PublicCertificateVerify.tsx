import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Award, 
  Shield, 
  GraduationCap, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  BookOpen,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface VerificationResult {
  valid: boolean;
  error?: string;
  status?: string;
  certificate?: {
    certificate_number: string;
    certificate_type: "completion_badge" | "verified" | "assessed";
    tier_label: string;
    holder_name: string;
    course_title: string;
    instructor_name: string | null;
    institution_name: string | null;
    completion_date: string;
    mastery_score: number | null;
    skill_breakdown: Record<string, number> | null;
    issued_at: string;
  };
  trust_indicators?: Array<{
    type: string;
    label: string;
    description: string;
  }>;
  verification_timestamp?: string;
}

const tierConfig = {
  completion_badge: {
    label: "Completion Badge",
    icon: GraduationCap,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    borderColor: "border-blue-500",
  },
  verified: {
    label: "Verified Certificate",
    icon: Shield,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    borderColor: "border-green-500",
  },
  assessed: {
    label: "Assessed Certificate",
    icon: Award,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    borderColor: "border-purple-500",
  },
};

export default function PublicCertificateVerify() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyCertificate() {
      if (!shareToken) return;

      try {
        const { data, error } = await supabase.functions.invoke("verify-certificate", {
          body: { share_token: shareToken },
        });

        if (error) {
          setResult({ valid: false, error: error.message });
        } else {
          setResult(data);
        }
      } catch (error) {
        setResult({ 
          valid: false, 
          error: error instanceof Error ? error.message : "Verification failed" 
        });
      } finally {
        setLoading(false);
      }
    }

    verifyCertificate();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="space-y-4">
            <Skeleton className="h-16 w-16 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-6 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!result || !result.valid) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-destructive">
          <CardContent className="pt-8 text-center space-y-4">
            <div className="mx-auto p-4 rounded-full bg-destructive/10">
              {result?.status === "revoked" ? (
                <XCircle className="h-12 w-12 text-destructive" />
              ) : (
                <AlertCircle className="h-12 w-12 text-destructive" />
              )}
            </div>
            
            <div>
              <h1 className="text-xl font-bold text-destructive">
                {result?.status === "revoked" 
                  ? "Certificate Revoked" 
                  : "Certificate Not Found"}
              </h1>
              <p className="text-muted-foreground mt-2">
                {result?.error || "This certificate could not be verified."}
              </p>
            </div>

            <Separator />

            <div className="text-sm text-muted-foreground">
              <p>If you believe this is an error, please contact:</p>
              <p className="font-medium">support@syllabusstack.com</p>
            </div>

            <Button asChild variant="outline">
              <Link to="/">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cert = result.certificate!;
  const config = tierConfig[cert.certificate_type];
  const TierIcon = config.icon;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Verification status banner */}
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">
                Certificate Verified
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Verified on {format(new Date(result.verification_timestamp!), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Main certificate card */}
        <Card className={`border-t-4 ${config.borderColor}`}>
          <CardHeader className="text-center space-y-4">
            <div className={`mx-auto p-4 rounded-full ${config.color}`}>
              <TierIcon className="h-10 w-10" />
            </div>
            
            <div>
              <Badge className={config.color}>{cert.tier_label}</Badge>
              <h1 className="text-2xl font-bold mt-2">{cert.course_title}</h1>
              <p className="text-lg text-muted-foreground">
                Certificate of {cert.certificate_type === "assessed" ? "Mastery" : "Completion"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Certificate holder */}
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground mb-1">Awarded to</p>
              <p className="text-2xl font-semibold">{cert.holder_name}</p>
              <p className="text-sm text-muted-foreground mt-2">
                for successfully completing the requirements
              </p>
            </div>

            {/* Mastery score for assessed certificates */}
            {cert.certificate_type === "assessed" && cert.mastery_score !== null && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Mastery Score</p>
                <div className="text-4xl font-bold text-primary">
                  {Math.round(cert.mastery_score)}%
                </div>
                {cert.skill_breakdown && Object.keys(cert.skill_breakdown).length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm max-w-sm mx-auto">
                    {Object.entries(cert.skill_breakdown).map(([skill, score]) => (
                      <div key={skill} className="flex justify-between bg-muted/50 rounded px-3 py-1">
                        <span className="truncate">{skill}</span>
                        <span className="font-medium">{Math.round(score as number)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Meta information */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Completed</p>
                  <p className="font-medium">
                    {format(new Date(cert.completion_date), "MMMM d, yyyy")}
                  </p>
                </div>
              </div>
              
              {cert.instructor_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Instructor</p>
                    <p className="font-medium">{cert.instructor_name}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Certificate ID</p>
                  <p className="font-mono font-medium">{cert.certificate_number}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Issued</p>
                  <p className="font-medium">
                    {format(new Date(cert.issued_at), "MMMM d, yyyy")}
                  </p>
                </div>
              </div>
            </div>

            {/* Trust indicators */}
            {result.trust_indicators && result.trust_indicators.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3 text-center">
                    Trust Indicators
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {result.trust_indicators.map((indicator) => (
                      <Badge 
                        key={indicator.type} 
                        variant="outline" 
                        className="gap-1"
                        title={indicator.description}
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {indicator.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            This certificate was issued by{" "}
            <Link to="/" className="text-primary hover:underline">SyllabusStack</Link>
          </p>
          <p className="mt-1">
            For employer verification API access, visit{" "}
            <Link to="/employer/signup" className="text-primary hover:underline">
              employer portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
